import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

interface PeerConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
}

export function useWebRTC(roomId: string, supabase: SupabaseClient, localStream: MediaStream | null, userId: string) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !supabase || !userId) return;

    const channel = supabase.channel(`meet-${roomId}`);
    channelRef.current = channel;

    const createPeer = (targetUserId: string, initiator: boolean) => {
      if (peersRef.current.has(targetUserId)) return peersRef.current.get(targetUserId)!.pc;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const remoteStream = new MediaStream();
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetUserId, remoteStream);
        return next;
      });

      peersRef.current.set(targetUserId, { pc, stream: remoteStream });

      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc-ice',
            payload: { targetUserId, senderUserId: userId, candidate: event.candidate }
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.delete(targetUserId);
            return next;
          });
          peersRef.current.delete(targetUserId);
        }
      };

      if (initiator) {
        pc.createOffer().then(offer => {
          return pc.setLocalDescription(offer);
        }).then(() => {
          channel.send({
            type: 'broadcast',
            event: 'webrtc-offer',
            payload: { targetUserId, senderUserId: userId, offer: pc.localDescription }
          });
        }).catch(console.error);
      }

      return pc;
    };

    channel
      .on('broadcast', { event: 'user-joined' }, ({ payload }) => {
        if (payload.senderUserId !== userId) {
          createPeer(payload.senderUserId, true);
        }
      })
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetUserId === userId) {
          const pc = createPeer(payload.senderUserId, false);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'webrtc-answer',
            payload: { targetUserId: payload.senderUserId, senderUserId: userId, answer: pc.localDescription }
          });
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.targetUserId === userId) {
          const peer = peersRef.current.get(payload.senderUserId);
          if (peer) {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }
        }
      })
      .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
        if (payload.targetUserId === userId) {
          const peer = peersRef.current.get(payload.senderUserId);
          if (peer) {
            await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { senderUserId: userId }
          });
        }
      });

    return () => {
      peersRef.current.forEach(peer => peer.pc.close());
      peersRef.current.clear();
      channel.unsubscribe();
    };
  }, [roomId, supabase, userId, localStream]);

  // Handle stream updates
  useEffect(() => {
    peersRef.current.forEach(({ pc }) => {
      const senders = pc.getSenders();
      if (localStream) {
        localStream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, localStream);
          }
        });
      }
    });
  }, [localStream]); // eslint-disable-line react-hooks/exhaustive-deps

  return { remoteStreams };
}
