import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import exifr from 'exifr';
import sharp from 'sharp';
import { computeSha256, computeDHash } from '@/lib/hashing';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { getSignedUrlForPhoto } from '@/lib/storage';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No media file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || 'image/jpeg';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');

    // 1. Checksum for exact duplicate check
    const checksum = computeSha256(buffer);
    const { data: existingExact } = await supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .eq('checksum', checksum)
      .maybeSingle();

    if (existingExact) {
      // Gracefully resolve signed URL for existing asset rather than crashing with 409
      let existingUrl = existingExact.cloudinary_url;
      if (!existingUrl && existingExact.storage_path) {
        existingUrl = await getSignedUrlForPhoto(supabase, existingExact.storage_path, 3600);
      }

      return NextResponse.json({
        success: true,
        photo: {
          ...existingExact,
          url: existingUrl,
        },
        isDuplicate: true,
        message: 'Photograph already preserved in your Universe.',
      });
    }

    // 2. Compute perceptual hash for images only
    let perceptualHash: string | null = null;
    if (isImage) {
      try {
        perceptualHash = await computeDHash(buffer);
      } catch (hashErr) {
        console.warn('[upload] dHash computation skipped:', hashErr);
      }
    }

    // 3. Extract dimensions (images only, safely avoid crash on video/audio)
    let width: number | null = null;
    let height: number | null = null;
    if (isImage) {
      try {
        const imgMeta = await sharp(buffer).metadata();
        width = imgMeta.width ?? null;
        height = imgMeta.height ?? null;
      } catch (sharpErr) {
        console.warn('[upload] Sharp metadata skipped:', sharpErr);
      }
    }

    // 4. Extract EXIF and reverse geocode (images only)
    let capturedAt = new Date();
    const exifMetadata = {
      make: null as string | null,
      model: null as string | null,
      latitude: null as number | null,
      longitude: null as number | null,
      city: null as string | null,
      country: null as string | null,
    };

    if (isImage) {
      try {
        const parsedExif = await exifr.parse(buffer, {
          tiff: true,
          exif: true,
          gps: true,
        });

        if (parsedExif) {
          if (parsedExif.DateTimeOriginal) {
            capturedAt = new Date(parsedExif.DateTimeOriginal);
          } else if (parsedExif.CreateDate) {
            capturedAt = new Date(parsedExif.CreateDate);
          } else if (parsedExif.ModifyDate) {
            capturedAt = new Date(parsedExif.ModifyDate);
          }

          if (parsedExif.Make) exifMetadata.make = String(parsedExif.Make).trim();
          if (parsedExif.Model) exifMetadata.model = String(parsedExif.Model).trim();

          if (
            typeof parsedExif.latitude === 'number' &&
            typeof parsedExif.longitude === 'number' &&
            !isNaN(parsedExif.latitude) &&
            !isNaN(parsedExif.longitude)
          ) {
            exifMetadata.latitude = parsedExif.latitude;
            exifMetadata.longitude = parsedExif.longitude;
          }
        }
      } catch (exifErr) {
        console.warn('[upload] EXIF parse skipped:', exifErr);
      }
    }

    // Fallback coordinates from client (e.g. mobile device GPS or camera capture)
    const clientLat = formData.get('latitude') as string | null;
    const clientLng = formData.get('longitude') as string | null;
    if (exifMetadata.latitude == null && clientLat && clientLng) {
      const latNum = parseFloat(clientLat);
      const lngNum = parseFloat(clientLng);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        exifMetadata.latitude = latNum;
        exifMetadata.longitude = lngNum;
      }
    }

    // Reverse geocode if coordinates are available
    if (exifMetadata.latitude != null && exifMetadata.longitude != null) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${exifMetadata.latitude}&lon=${exifMetadata.longitude}&zoom=10`,
          {
            headers: {
              'User-Agent': 'MemoryUniverse/1.0 (contact@memoryuniverse.app)',
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const geoData = await res.json();
          if (geoData && geoData.address) {
            exifMetadata.city =
              geoData.address.city ||
              geoData.address.town ||
              geoData.address.village ||
              geoData.address.municipality ||
              geoData.address.county ||
              null;
            exifMetadata.country = geoData.address.country || null;
          }
        }
      } catch (ge) {
        console.warn('[upload] Reverse geocoding skipped:', ge);
      }
    }

    // 5. Cloudinary Upload (Strict Naming Convention, Auto Resource Type for video/audio)
    const originalFilename = file.name || `media_${Date.now()}.${isAudio ? 'mp3' : isVideo ? 'mp4' : 'jpg'}`;
    let cloudinaryUrl: string | null = null;
    let cloudinaryPublicId: string | null = null;
    let storageProvider = 'supabase';

    try {
      const cloudRes = await uploadToCloudinary(buffer, originalFilename);
      if (cloudRes && cloudRes.url) {
        cloudinaryUrl = cloudRes.url;
        cloudinaryPublicId = cloudRes.publicId;
        storageProvider = 'cloudinary';
        if (cloudRes.width && !width) width = cloudRes.width;
        if (cloudRes.height && !height) height = cloudRes.height;
      }
    } catch (cErr) {
      console.warn('[upload] Cloudinary upload skipped:', cErr);
    }

    // 6. Supabase Storage Upload (Private Redundant Backup)
    const dummyUserId = '00000000-0000-0000-0000-000000000000';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const photoId = crypto.randomUUID();
    const extension = (originalFilename.split('.').pop() || (isAudio ? 'mp3' : isVideo ? 'mp4' : 'jpg')).toLowerCase();
    const storagePath = `users/${dummyUserId}/photos/${year}/${month}/${photoId}/original.${extension}`;

    const { error: storageError } = await supabase.storage
      .from('memories')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (storageError && !cloudinaryUrl) {
      throw storageError;
    }

    // 7. Resolve signed URL from Supabase storage so photo.url is NEVER null!
    let resolvedUrl = cloudinaryUrl;
    if (!resolvedUrl && storagePath) {
      resolvedUrl = await getSignedUrlForPhoto(supabase, storagePath, 3600);
    }

    // 8. Insert Photo record
    const { data: dbData, error: dbError } = await supabase
      .from('photos')
      .insert({
        id: photoId,
        user_id: dummyUserId,
        original_filename: originalFilename,
        checksum,
        perceptual_hash: perceptualHash,
        mime_type: mimeType,
        size_bytes: file.size || buffer.length,
        width,
        height,
        storage_path: storagePath,
        cloudinary_url: cloudinaryUrl,
        cloudinary_public_id: cloudinaryPublicId,
        storage_provider: storageProvider,
        captured_at: capturedAt.toISOString(),
        visibility: 'PRIVATE',
        is_archived: false,
        is_favorite: false,
      })
      .select()
      .single();

    if (dbError) {
      if (storagePath) await supabase.storage.from('memories').remove([storagePath]);
      throw dbError;
    }

    
    const response = NextResponse.json({
      success: true,
      photo: {
        ...dbData,
        url: resolvedUrl,
      },
      message: 'Upload successful. Processing AI metadata in background.',
    });

    waitUntil((async () => {
        try {
// 9. Auto Gemini AI Multimodal Vision Analysis (images only)
    let aiTitle: string | null = null;
    let aiDescription: string | null = null;
    let aiTags: string[] | null = null;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && (isImage || isAudio || isVideo)) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        
        const aiPrompt = 'You are an artistic archivist documenting memories in a personal universe. Look closely at this media (image/audio/video). Return a JSON object with: "title" (poetic title of 2 to 4 words), "description" (cinematic 2-sentence description of mood and scene), "tags" (5 to 7 keyword strings), and "is_conventional_memory" (true if this is a personal photo/memory/event/nature, false if it is a screenshot, receipt, meme, text document, or junk). ONLY valid JSON.';
        const modelName = isImage ? "gemini-2.5-flash" : "gemini-1.5-pro";

        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            aiPrompt,
            {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: mimeType,
              },
            },
          ],
          config: { responseMimeType: 'application/json' },
        });

        if (response.text) {
          let cleanText = response.text.trim();
          if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          const parsed = JSON.parse(cleanText);
          aiTitle = parsed.title || null;
          aiDescription = parsed.description || null;
          aiTags = Array.isArray(parsed.tags) ? parsed.tags : null;
          // NEW: Generate Semantic Embedding
          try {
            const embedRes = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: (aiTitle || '') + ' ' + (aiDescription || '') + ' ' + (aiTags ? aiTags.join(' ') : ''),
            });
            if (embedRes.embeddings && embedRes.embeddings.length > 0) {
                const vector = embedRes.embeddings[0].values;
                await supabase.from('photos').update({ semantic_embedding: `[${vector.join(',')}]` }).eq('id', photoId);
            }
          } catch (e) {
             console.warn('Embedding skipped', e);
          }
          
          if (parsed.is_conventional_memory === false) {
             // If AI determines this is a screenshot, meme, receipt, etc., auto-archive it (soft delete/hide)
             await supabase.from('photos').update({ is_archived: true }).eq('id', photoId);
          }
        }
      } catch (aiErr) {
        console.warn('[upload] Auto Gemini analysis skipped:', aiErr);
      }
    }

    // 10. Insert photo_metadata
    await supabase.from('photo_metadata').insert({
      photo_id: photoId,
      make: exifMetadata.make,
      model: exifMetadata.model,
      latitude: exifMetadata.latitude,
      longitude: exifMetadata.longitude,
      city: exifMetadata.city,
      country: exifMetadata.country,
      ai_title: aiTitle,
      ai_description: aiDescription,
      ai_tags: aiTags,
    });

    // 11. Face recognition and people clustering (images only)
    if (isImage) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const faceapi = require('@vladmandic/face-api');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Canvas, Image, ImageData, loadImage } = require('canvas');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();

        const modelsPath = path.join(process.cwd(), 'public', 'models');
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

        const img = await loadImage(buffer);
        const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

        if (detections && detections.length > 0) {
          for (const detection of detections) {
            const descriptor = Array.from(detection.descriptor);
            const box = detection.detection.box;
            const confidence = detection.detection.score;

            let assignedPersonId: string | null = null;
            try {
              const { data: matches } = await supabase.rpc('match_faces', {
                query_embedding: `[${descriptor.join(',')}]`,
                match_threshold: 0.5,
                match_count: 5,
              });

              if (matches && Array.isArray(matches) && matches.length > 0) {
                const matchedPerson = matches.find((m: { person_id?: string | null }) => m.person_id != null);
                if (matchedPerson?.person_id) assignedPersonId = matchedPerson.person_id;
              }
            } catch {
              // Ignore vector match errors
            }

            if (!assignedPersonId) {
              try {
                const { count: peopleCount } = await supabase
                  .from('people')
                  .select('*', { count: 'exact', head: true });

                const personName = `Person #${(peopleCount ?? 0) + 1}`;
                const { data: newPerson } = await supabase
                  .from('people')
                  .insert({
                    user_id: dummyUserId,
                    name: personName,
                    cover_photo_id: photoId,
                  })
                  .select('id')
                  .single();

                if (newPerson) assignedPersonId = newPerson.id;
              } catch {
                // Ignore person creation errors
              }
            }

            await supabase.from('photo_faces').insert({
              photo_id: photoId,
              person_id: assignedPersonId,
              bounding_box: box,
              embedding: `[${descriptor.join(',')}]`,
              confidence: confidence,
            });
          }
        }
      } catch (e) {
        console.warn('[upload] Face processing skipped:', e);
      }
    }

    
        } catch (e) {
            console.error("Background task error", e);
        }
    })());

    return response;
  } catch (error: unknown) {
    console.error('[upload] Critical error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
