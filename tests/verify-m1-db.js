require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Helpers for generating unit vectors
function makeVector(nonZeroIndex, value = 1.0, length = 128) {
  const vec = new Array(length).fill(0.0);
  if (nonZeroIndex >= 0 && nonZeroIndex < length) {
    vec[nonZeroIndex] = value;
  }
  return vec;
}

function vectorToString(vec) {
  return `[${vec.join(',')}]`;
}

async function runEmpiricalVerification() {
  console.log('====================================================');
  console.log('   M1 EMPIRICAL DATABASE & RPC VERIFICATION SUITE   ');
  console.log('====================================================\n');

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await pgClient.connect();
  console.log('✔ Connected to PostgreSQL via pg client.');
  console.log('✔ Connected to Supabase Admin Client.\n');

  const createdPhotoIds = [];
  const createdPersonIds = [];
  const createdFaceIds = [];

  let allTestsPassed = true;
  const testResults = [];

  function recordResult(testName, passed, details) {
    testResults.push({ testName, passed, details });
    if (passed) {
      console.log(`  [PASS] ${testName}`);
      if (details) console.log(`         -> ${details}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (details) console.error(`         -> ${details}`);
      allTestsPassed = false;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test Group 1: Schema & Indexes Verification
    // -------------------------------------------------------------
    console.log('--- Test Group 1: Schema & Vector Index Verification ---');

    // Check pgvector extension
    const extRes = await pgClient.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    recordResult(
      'pgvector extension is installed',
      extRes.rows.length === 1,
      `Found extension: ${extRes.rows.map(r => r.extname).join(', ')}`
    );

    // Check photo_metadata columns: ai_title, ai_description, ai_tags
    const colsRes = await pgClient.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'photo_metadata' 
        AND column_name IN ('ai_title', 'ai_description', 'ai_tags');
    `);
    const colNames = colsRes.rows.map(r => r.column_name);
    recordResult(
      'photo_metadata contains ai_title, ai_description, ai_tags',
      colNames.includes('ai_title') && colNames.includes('ai_description') && colNames.includes('ai_tags'),
      `Columns found: ${colNames.join(', ')}`
    );

    // Check photos columns: perceptual_hash, width, height
    const photoColsRes = await pgClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'photos' 
        AND column_name IN ('perceptual_hash', 'width', 'height');
    `);
    const photoColNames = photoColsRes.rows.map(r => r.column_name);
    recordResult(
      'photos table contains perceptual_hash, width, height',
      photoColNames.includes('perceptual_hash') && photoColNames.includes('width') && photoColNames.includes('height'),
      `Columns found: ${photoColNames.join(', ')}`
    );

    // Check HNSW Vector Index
    const hnswIndexRes = await pgClient.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'photo_faces' AND indexname = 'idx_photo_faces_embedding_hnsw';
    `);
    recordResult(
      'HNSW vector index exists on photo_faces(embedding)',
      hnswIndexRes.rows.length === 1,
      hnswIndexRes.rows[0]?.indexdef
    );

    // Check B-Tree and Foreign Key Indexes
    const expectedIndexes = [
      'idx_photos_checksum',
      'idx_photos_perceptual_hash',
      'idx_photos_captured_at',
      'idx_photo_metadata_city',
      'idx_photo_metadata_country',
      'idx_photo_faces_photo_id',
      'idx_photo_faces_person_id',
    ];
    const allIndexesRes = await pgClient.query(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
    `);
    const existingIndexNames = allIndexesRes.rows.map(r => r.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !existingIndexNames.includes(idx));
    recordResult(
      'All expected B-Tree and FK indexes are present',
      missingIndexes.length === 0,
      missingIndexes.length === 0 ? 'All 7 indexes present' : `Missing: ${missingIndexes.join(', ')}`
    );

    // -------------------------------------------------------------
    // Test Group 2: match_faces RPC Empirical Vector Distance
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: match_faces RPC Empirical Verification ---');

    // Create a mock photo for foreign key requirement
    const testPhotoId = crypto.randomUUID();
    createdPhotoIds.push(testPhotoId);
    await pgClient.query(`
      INSERT INTO photos (id, original_filename, checksum, visibility)
      VALUES ($1, 'test_vector_photo.jpg', 'checksum_test_123', 'PRIVATE')
    `, [testPhotoId]);

    // Create mock Person A
    const personARes = await pgClient.query(`
      INSERT INTO people (name) VALUES ('Test Person Vector A') RETURNING id
    `);
    const personAId = personARes.rows[0].id;
    createdPersonIds.push(personAId);

    // Create mock Person B
    const personBRes = await pgClient.query(`
      INSERT INTO people (name) VALUES ('Test Person Vector B') RETURNING id
    `);
    const personBId = personBRes.rows[0].id;
    createdPersonIds.push(personBId);

    // Vector A = [1.0, 0, 0, ..., 0] (unit vector along dimension 0)
    const vecA = makeVector(0, 1.0, 128);
    // Vector B = [0, 1.0, 0, ..., 0] (unit vector along dimension 1)
    const vecB = makeVector(1, 1.0, 128);

    // Insert Face A (associated with Person A)
    const faceARes = await pgClient.query(`
      INSERT INTO photo_faces (photo_id, person_id, embedding, confidence)
      VALUES ($1, $2, $3::vector, 0.99)
      RETURNING id
    `, [testPhotoId, personAId, vectorToString(vecA)]);
    const faceAId = faceARes.rows[0].id;
    createdFaceIds.push(faceAId);

    // Insert Face B (associated with Person B)
    const faceBRes = await pgClient.query(`
      INSERT INTO photo_faces (photo_id, person_id, embedding, confidence)
      VALUES ($1, $2, $3::vector, 0.95)
      RETURNING id
    `, [testPhotoId, personBId, vectorToString(vecB)]);
    const faceBId = faceBRes.rows[0].id;
    createdFaceIds.push(faceBId);

    // Query Vector Q = [0.95, 0, 0, ..., 0]
    // Expected distance to Vector A: |1.0 - 0.95| = 0.05
    // Expected distance to Vector B: sqrt(0.95^2 + 1.0^2) = sqrt(0.9025 + 1.0) = sqrt(1.9025) ≈ 1.379311
    const vecQ = makeVector(0, 0.95, 128);
    const expectedDistA = 0.05;
    const expectedDistB = Math.sqrt(0.95 * 0.95 + 1.0 * 1.0); // ~1.3793114

    // Test 2.1: Query match_faces with threshold = 0.55 (default FaceNet clustering threshold)
    // Vector A should match (dist ~0.05 <= 0.55), Vector B should NOT match (dist ~1.38 > 0.55)
    const rpcRes1 = await pgClient.query(`
      SELECT * FROM match_faces($1::vector, 0.55, 5);
    `, [vectorToString(vecQ)]);

    const matchFaceIds1 = rpcRes1.rows.map(r => r.face_id);
    const distFaceA1 = rpcRes1.rows.find(r => r.face_id === faceAId)?.distance;

    const test2_1_passed = 
      rpcRes1.rows.length >= 1 &&
      matchFaceIds1.includes(faceAId) &&
      !matchFaceIds1.includes(faceBId) &&
      Math.abs(distFaceA1 - expectedDistA) < 1e-4;

    recordResult(
      'match_faces matches Vector A within threshold 0.55 and excludes Vector B',
      test2_1_passed,
      `Matches: ${rpcRes1.rows.length}, Face A distance: ${distFaceA1?.toFixed(6)} (expected ~0.050000)`
    );

    // Test 2.2: Query match_faces via Supabase JS Client RPC
    const { data: sbMatches, error: sbRpcErr } = await supabase.rpc('match_faces', {
      query_embedding: vectorToString(vecQ),
      match_threshold: 0.55,
      match_count: 5,
    });

    const sbMatchIds = (sbMatches || []).map(m => m.face_id);
    const test2_2_passed = 
      !sbRpcErr &&
      Array.isArray(sbMatches) &&
      sbMatchIds.includes(faceAId) &&
      !sbMatchIds.includes(faceBId);

    recordResult(
      'Supabase JS client supabase.rpc("match_faces") matches Vector A and excludes Vector B',
      test2_2_passed,
      sbRpcErr ? `Error: ${sbRpcErr.message}` : `Matched face_id: ${sbMatchIds.join(', ')}`
    );

    // Test 2.3: Query match_faces with threshold = 1.5 (should include both Vector A and Vector B, ordered by distance)
    const rpcResWide = await pgClient.query(`
      SELECT * FROM match_faces($1::vector, 1.5, 10);
    `, [vectorToString(vecQ)]);

    const faceARow = rpcResWide.rows.find(r => r.face_id === faceAId);
    const faceBRow = rpcResWide.rows.find(r => r.face_id === faceBId);
    const faceAIndex = rpcResWide.rows.findIndex(r => r.face_id === faceAId);
    const faceBIndex = rpcResWide.rows.findIndex(r => r.face_id === faceBId);

    const test2_3_passed =
      faceARow &&
      faceBRow &&
      faceAIndex < faceBIndex &&
      Math.abs(faceARow.distance - expectedDistA) < 1e-4 &&
      Math.abs(faceBRow.distance - expectedDistB) < 1e-4;

    recordResult(
      'match_faces with threshold 1.5 returns both vectors in ascending distance order',
      test2_3_passed,
      `Face A dist: ${faceARow?.distance?.toFixed(6)}, Face B dist: ${faceBRow?.distance?.toFixed(6)} (expected ~${expectedDistB.toFixed(6)})`
    );

    // Test 2.4: Query match_faces with strict threshold = 0.01 (should return neither)
    const rpcResStrict = await pgClient.query(`
      SELECT * FROM match_faces($1::vector, 0.01, 5);
    `, [vectorToString(vecQ)]);
    const matchIdsStrict = rpcResStrict.rows.map(r => r.face_id);

    const test2_4_passed = !matchIdsStrict.includes(faceAId) && !matchIdsStrict.includes(faceBId);
    recordResult(
      'match_faces with strict threshold 0.01 excludes all vectors outside tolerance',
      test2_4_passed,
      `Returned count: ${rpcResStrict.rows.length}`
    );

    // -------------------------------------------------------------
    // Test Group 3: merge_people RPC Empirical Verification
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: merge_people RPC Empirical Verification ---');

    // Create target person A
    const targetPersonRes = await pgClient.query(`
      INSERT INTO people (name) VALUES ('Target Person A') RETURNING id
    `);
    const targetPersonId = targetPersonRes.rows[0].id;
    createdPersonIds.push(targetPersonId);

    // Create source person B (with a cover photo)
    const sourcePersonBRes = await pgClient.query(`
      INSERT INTO people (name, cover_photo_id) VALUES ('Source Person B', $1) RETURNING id
    `, [testPhotoId]);
    const sourcePersonBId = sourcePersonBRes.rows[0].id;
    createdPersonIds.push(sourcePersonBId);

    // Create source person C
    const sourcePersonCRes = await pgClient.query(`
      INSERT INTO people (name) VALUES ('Source Person C') RETURNING id
    `);
    const sourcePersonCId = sourcePersonCRes.rows[0].id;
    createdPersonIds.push(sourcePersonCId);

    // Assign faces to Target Person A (Face 1)
    const f1Res = await pgClient.query(`
      INSERT INTO photo_faces (photo_id, person_id, embedding, confidence)
      VALUES ($1, $2, $3::vector, 0.90) RETURNING id
    `, [testPhotoId, targetPersonId, vectorToString(makeVector(2, 1.0))]);
    createdFaceIds.push(f1Res.rows[0].id);

    // Assign faces to Source Person B (Face 2, Face 3)
    const f2Res = await pgClient.query(`
      INSERT INTO photo_faces (photo_id, person_id, embedding, confidence)
      VALUES ($1, $2, $3::vector, 0.91) RETURNING id
    `, [testPhotoId, sourcePersonBId, vectorToString(makeVector(3, 1.0))]);
    createdFaceIds.push(f2Res.rows[0].id);

    const f3Res = await pgClient.query(`
      INSERT INTO photo_faces (photo_id, person_id, embedding, confidence)
      VALUES ($1, $2, $3::vector, 0.92) RETURNING id
    `, [testPhotoId, sourcePersonBId, vectorToString(makeVector(4, 1.0))]);
    createdFaceIds.push(f3Res.rows[0].id);

    // Assign faces to Source Person C (Face 4)
    const f4Res = await pgClient.query(`
      INSERT INTO photo_faces (photo_id, person_id, embedding, confidence)
      VALUES ($1, $2, $3::vector, 0.93) RETURNING id
    `, [testPhotoId, sourcePersonCId, vectorToString(makeVector(5, 1.0))]);
    createdFaceIds.push(f4Res.rows[0].id);

    const allTestFaces = [f1Res.rows[0].id, f2Res.rows[0].id, f3Res.rows[0].id, f4Res.rows[0].id];

    // Verify initial assignment count
    const initialFacesA = (await pgClient.query(`SELECT COUNT(*) FROM photo_faces WHERE person_id = $1`, [targetPersonId])).rows[0].count;
    const initialFacesB = (await pgClient.query(`SELECT COUNT(*) FROM photo_faces WHERE person_id = $1`, [sourcePersonBId])).rows[0].count;
    const initialFacesC = (await pgClient.query(`SELECT COUNT(*) FROM photo_faces WHERE person_id = $1`, [sourcePersonCId])).rows[0].count;

    console.log(`  Initial face counts -> Target A: ${initialFacesA}, Source B: ${initialFacesB}, Source C: ${initialFacesC}`);

    // Call merge_people RPC via Supabase JS client
    const { error: mergeErr } = await supabase.rpc('merge_people', {
      target_person_id: targetPersonId,
      source_person_ids: [sourcePersonBId, sourcePersonCId],
    });

    recordResult(
      'merge_people RPC executes cleanly via Supabase JS client',
      !mergeErr,
      mergeErr ? `Error: ${mergeErr.message}` : 'RPC returned void successfully'
    );

    // Verify all 4 faces are now assigned to targetPersonId
    const reassignedFacesRes = await pgClient.query(`
      SELECT id, person_id FROM photo_faces WHERE id = ANY($1)
    `, [allTestFaces]);

    const allAssignedToTarget = reassignedFacesRes.rows.every(r => r.person_id === targetPersonId);
    recordResult(
      'All faces from Source B and Source C are reassigned to Target Person A',
      allAssignedToTarget && reassignedFacesRes.rows.length === 4,
      `Reassigned faces count: ${reassignedFacesRes.rows.filter(r => r.person_id === targetPersonId).length}/4`
    );

    // Verify source people are deleted from people table
    const survivingSourcePeople = await pgClient.query(`
      SELECT id FROM people WHERE id IN ($1, $2)
    `, [sourcePersonBId, sourcePersonCId]);

    recordResult(
      'Source people (B and C) are deleted from people table',
      survivingSourcePeople.rows.length === 0,
      `Surviving source people count: ${survivingSourcePeople.rows.length}`
    );

    // Verify target person still exists and inherited cover_photo_id
    const targetPersonCheck = await pgClient.query(`
      SELECT id, name, cover_photo_id FROM people WHERE id = $1
    `, [targetPersonId]);

    const targetSurvives = targetPersonCheck.rows.length === 1;
    const targetHasCover = targetPersonCheck.rows[0]?.cover_photo_id === testPhotoId;

    recordResult(
      'Target person survives and inherited cover_photo_id from source person',
      targetSurvives && targetHasCover,
      `Target id: ${targetPersonCheck.rows[0]?.id}, cover_photo_id: ${targetPersonCheck.rows[0]?.cover_photo_id}`
    );

    // Test 3.2: merge_people edge case: target ID included in source array
    await pgClient.query(`SELECT merge_people($1, ARRAY[$1::uuid]);`, [targetPersonId]);

    const targetStillExists = (await pgClient.query(`SELECT id FROM people WHERE id = $1`, [targetPersonId])).rows.length === 1;
    recordResult(
      'merge_people handles target ID in source array without self-deletion',
      targetStillExists,
      'Target person remains intact'
    );

    // Test 3.3: merge_people edge case: NULL and empty array handling
    await pgClient.query(`SELECT merge_people($1, NULL);`, [targetPersonId]);
    await pgClient.query(`SELECT merge_people($1, ARRAY[]::uuid[]);`, [targetPersonId]);
    
    // Supabase RPC with empty array
    const { error: sbEmptyMergeErr } = await supabase.rpc('merge_people', {
      target_person_id: targetPersonId,
      source_person_ids: [],
    });

    recordResult(
      'merge_people handles NULL and empty arrays gracefully across SQL and Supabase client',
      !sbEmptyMergeErr,
      sbEmptyMergeErr ? `Error: ${sbEmptyMergeErr.message}` : 'No SQL/RPC errors thrown on empty/null inputs'
    );

  } catch (err) {
    console.error('UNEXPECTED EXCEPTION DURING SUITE EXECUTION:', err);
    allTestsPassed = false;
  } finally {
    // -------------------------------------------------------------
    // Test Group 4: Teardown and Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Teardown and Cleanup ---');
    try {
      if (createdFaceIds.length > 0) {
        await pgClient.query(`DELETE FROM photo_faces WHERE id = ANY($1)`, [createdFaceIds]);
      }
      if (createdPersonIds.length > 0) {
        await pgClient.query(`DELETE FROM people WHERE id = ANY($1)`, [createdPersonIds]);
      }
      if (createdPhotoIds.length > 0) {
        await pgClient.query(`DELETE FROM photos WHERE id = ANY($1)`, [createdPhotoIds]);
      }

      // Verify zero dangling rows
      const danglingFaces = (await pgClient.query(`SELECT COUNT(*) FROM photo_faces WHERE id = ANY($1)`, [createdFaceIds])).rows[0].count;
      const danglingPeople = (await pgClient.query(`SELECT COUNT(*) FROM people WHERE id = ANY($1)`, [createdPersonIds])).rows[0].count;
      const danglingPhotos = (await pgClient.query(`SELECT COUNT(*) FROM photos WHERE id = ANY($1)`, [createdPhotoIds])).rows[0].count;

      const cleanupSuccess = (Number(danglingFaces) === 0 && Number(danglingPeople) === 0 && Number(danglingPhotos) === 0);
      recordResult(
        'All mock test data (photos, faces, people) cleaned up completely',
        cleanupSuccess,
        `Dangling faces: ${danglingFaces}, people: ${danglingPeople}, photos: ${danglingPhotos}`
      );
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }

    await pgClient.end();
  }

  console.log('\n====================================================');
  console.log(`SUITE SUMMARY: ${testResults.filter(r => r.passed).length}/${testResults.length} TESTS PASSED`);
  console.log(`FINAL VERDICT: ${allTestsPassed ? 'APPROVE' : 'REQUEST_CHANGES'}`);
  console.log('====================================================');

  process.exit(allTestsPassed ? 0 : 1);
}

runEmpiricalVerification();
