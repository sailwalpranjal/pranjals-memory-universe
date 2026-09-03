require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const faceapi = require('@vladmandic/face-api');
const { Canvas, Image, ImageData, loadImage } = require('canvas');

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function trainAdmin() {
  console.log("Loading models...");
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('./public/models');
  await faceapi.nets.faceLandmark68Net.loadFromDisk('./public/models');
  await faceapi.nets.faceRecognitionNet.loadFromDisk('./public/models');
  console.log("Models loaded.");

  const images = [
    'C:/Users/hp/.gemini/antigravity/brain/29ff3fd4-f729-4780-b443-3c3427fb9dbe/.user_uploaded/media_1788414238632.jpg',
    'C:/Users/hp/.gemini/antigravity/brain/29ff3fd4-f729-4780-b443-3c3427fb9dbe/.user_uploaded/media_1788414238738.png'
  ];

  // Insert Person
  const { data: person, error: personError } = await supabase
    .from('people')
    .insert({ name: 'Pranjal (Admin)' })
    .select()
    .single();

  if (personError) {
    console.error("Error inserting person:", personError);
    return;
  }
  console.log("Created person Pranjal (Admin):", person.id);

  for (let i = 0; i < images.length; i++) {
    console.log(`Processing image ${i + 1}...`);
    const img = await loadImage(images[i]);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (detection) {
      const descriptor = Array.from(detection.descriptor);
      
      // Create a dummy photo
      const { data: photo, error: photoError } = await supabase
        .from('photos')
        .insert({
          original_filename: `admin_ref_${i}.jpg`,
          visibility: 'PRIVATE',
        })
        .select()
        .single();
      
      if (photoError) {
        console.error("Error creating dummy photo:", photoError);
        continue;
      }

      const { error: faceError } = await supabase
        .from('photo_faces')
        .insert({
          photo_id: photo.id,
          person_id: person.id,
          embedding: `[${descriptor.join(',')}]`,
          confidence: detection.detection.score,
          bounding_box: detection.detection.box
        });
      
      if (faceError) {
        console.error("Error inserting face:", faceError);
      } else {
        console.log(`Face ${i + 1} registered for Admin!`);
      }
    } else {
      console.log(`No face detected in image ${i + 1}`);
    }
  }
  console.log("Admin training complete.");
}

trainAdmin().catch(console.error);
