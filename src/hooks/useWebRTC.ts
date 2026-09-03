import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

interface PeerConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
  iceQueue: RTCIceCandidateInit[];
}

export function useWebRTC(roomId: string, supabase: SupabaseClient, localStream: MediaStream | null, userId: string) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!roomId || !supabase || !userId) return;

    const channel = supabase.channel(`meet-${roomId}`);
    channelRef.current = channel;

    const cleanupPeer = (targetUserId: string) => {
      const peer = peersRef.current.get(targetUserId);
      if (peer) {
        peer.pc.close();
        peersRef.current.delete(targetUserId);
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(targetUserId);
          return next;
        });
      }
    };

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

      peersRef.current.set(targetUserId, { pc, stream: remoteStream, iceQueue: [] });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
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
          cleanupPeer(targetUserId);
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
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        cleanupPeer(payload.senderUserId);
      })
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetUserId === userId) {
          const pc = createPeer(payload.senderUserId, false);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          
          // Process queued ICE candidates
          const peer = peersRef.current.get(payload.senderUserId);
          if (peer && peer.iceQueue.length > 0) {
            for (const candidate of peer.iceQueue) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            }
            peer.iceQueue = [];
          }

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
            // Process queued ICE candidates
            if (peer.iceQueue.length > 0) {
              for (const candidate of peer.iceQueue) {
                await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
              }
              peer.iceQueue = [];
            }
          }
        }
      })
      .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
        if (payload.targetUserId === userId) {
          const peer = peersRef.current.get(payload.senderUserId);
          if (peer) {
            if (peer.pc.remoteDescription) {
              await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.error);
            } else {
              peer.iceQueue.push(payload.candidate);
            }
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

    const handleUnload = () => {
      channel.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { senderUserId: userId }
      });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
      peersRef.current.forEach(peer => peer.pc.close());
      peersRef.current.clear();
      channel.unsubscribe();
    };
  }, [roomId, supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return { remoteStreams, channel: channelRef.current };
}
