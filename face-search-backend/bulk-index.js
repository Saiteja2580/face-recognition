// bulk-index.js

require("dotenv").config();
const {
  RekognitionClient,
  IndexFacesCommand,
} = require("@aws-sdk/client-rekognition");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

// --- CONFIGURATION ---
const BUCKET_NAME = "face-search-prototype-images-saiteja"; // <-- IMPORTANT: Change this
const COLLECTION_ID = "prototype-users";
const REGION = process.env.AWS_REGION;

// --- AWS CLIENTS ---
const rekognitionClient = new RekognitionClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });

const runIndexing = async () => {
  console.log("--- Starting Phase 1: Bulk Indexing ---");

  try {
    // 1. Get the list of all images from the S3 bucket
    console.log(`Listing images in bucket: ${BUCKET_NAME}`);
    const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const s3Objects = await s3Client.send(listCommand);

    if (!s3Objects.Contents || s3Objects.Contents.length === 0) {
      console.log("Bucket is empty. Nothing to index.");
      return;
    }

    console.log(`Found ${s3Objects.Contents.length} images to index.`);

    // 2. Loop through each image and index it
    for (const s3Object of s3Objects.Contents) {
      const imageName = s3Object.Key;
      console.log(`-> Indexing: ${imageName}`);

      const indexCommand = new IndexFacesCommand({
        CollectionId: COLLECTION_ID,
        Image: {
          S3Object: {
            Bucket: BUCKET_NAME,
            Name: imageName,
          },
        },
        ExternalImageId: imageName, // Use the filename as the unique ID
      });

      const response = await rekognitionClient.send(indexCommand);

      if (response.FaceRecords && response.FaceRecords.length > 0) {
        console.log(
          `   Success! Face ID: ${response.FaceRecords[0].Face.FaceId}`
        );
      } else {
        console.log("   Warning: No face detected in this image.");
      }
    }

    console.log("--- Bulk Indexing Complete ---");
  } catch (error) {
    console.error("An error occurred during indexing:", error);
  }
};

// Run the main function
runIndexing();
