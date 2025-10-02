// list-faces.js

require("dotenv").config();
const {
  RekognitionClient,
  ListFacesCommand,
} = require("@aws-sdk/client-rekognition");

// --- CONFIGURATION ---
const COLLECTION_ID = "prototype-users";
const REGION = process.env.AWS_REGION;

// --- AWS CLIENT ---
const rekognitionClient = new RekognitionClient({ region: REGION });

const runListFaces = async () => {
  try {
    console.log(`Listing faces in collection: ${COLLECTION_ID}`);
    const command = new ListFacesCommand({
      CollectionId: COLLECTION_ID,
      MaxResults: 100, // Adjust as needed
    });

    const response = await rekognitionClient.send(command);

    if (response.Faces && response.Faces.length > 0) {
      console.log(`Found ${response.Faces.length} faces:`);
      response.Faces.forEach((face) => {
        console.log(`  - Face ID: ${face.FaceId}`);
        console.log(`    Image ID (Filename): ${face.ExternalImageId}`);
        console.log("---");
      });
    } else {
      console.log("No faces found in this collection.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
};

runListFaces();
