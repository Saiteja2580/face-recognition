// index.js

// 1. Load our secret credentials from the .env file
require("dotenv").config();

const express = require("express");
const {
  RekognitionClient,
  ListCollectionsCommand,
  CreateCollectionCommand,
  SearchFacesByImageCommand,
} = require("@aws-sdk/client-rekognition");

const cors = require("cors");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

const app = express();
const port = 3001; // Or any port you prefer

app.use(cors());
app.use(express.json());

// 2. Configure the AWS Rekognition Client
// The SDK will automatically pick up your credentials from process.env
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION,
});
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// 3. A simple function to test our AWS connection
const testAwsConnection = async () => {
  try {
    console.log("Testing connection to AWS Rekognition...");
    const command = new ListCollectionsCommand({});
    const response = await rekognitionClient.send(command);
    console.log("Successfully connected to AWS Rekognition.");
    console.log("Existing collections:", response.CollectionIds);
    return true;
  } catch (error) {
    console.error("Failed to connect to AWS Rekognition:", error);
    return false;
  }
};

const collectionId = "prototype-users";
const createFaceCollection = async () => {
  try {
    // Check if collection already exists
    const listCollectionsResponse = await rekognitionClient.send(
      new ListCollectionsCommand({})
    );
    if (listCollectionsResponse.CollectionIds.includes(collectionId)) {
      console.log(`Collection '${collectionId}' already exists.`);
      return;
    }

    // Create the collection
    console.log(`Creating collection: ${collectionId}`);
    const createCollectionResponse = await rekognitionClient.send(
      new CreateCollectionCommand({ CollectionId: collectionId })
    );
    console.log("Collection created successfully:", createCollectionResponse);
  } catch (error) {
    console.error("Error creating collection:", error);
  }
};

app.get("/", (req, res) => {
  res.send("Face Search Backend is running!");
});

app.post("/api/get-presigned-url", async (req, res) => {
  // Generate a random, unique file name to avoid conflicts
  const imageName = crypto.randomBytes(16).toString("hex") + ".jpeg";
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: imageName,
    ContentType: "image/jpeg",
  });

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 }); // URL is valid for 60 seconds
    res.status(200).send({ uploadUrl, key: imageName });
  } catch (error) {
    console.error("Error generating pre-signed URL", error);
    res.status(500).send({ message: "Error generating upload URL" });
  }
});

// index.js -> The updated /api/search-face endpoint

app.post("/api/search-face", async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).send({ message: "S3 image key is required." });
  }

  try {
    const command = new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: { S3Object: { Bucket: process.env.BUCKET_NAME, Name: key } },
      FaceMatchThreshold: 85, // You might lower the threshold to find more potential matches
      MaxFaces: 50, // <-- INCREASED THIS VALUE
    });

    const response = await rekognitionClient.send(command);

    if (response.FaceMatches && response.FaceMatches.length > 0) {
      console.log(`Found ${response.FaceMatches.length} matches.`);

      // Use Promise.all to generate signed URLs for all matches concurrently
      const matches = await Promise.all(
        response.FaceMatches.map(async (match) => {
          const personId = match.Face.ExternalImageId;
          const getObjectParams = { Bucket: process.env.BUCKET_NAME, Key: personId };
          const getCommand = new GetObjectCommand(getObjectParams);
          const imageUrl = await getSignedUrl(s3Client, getCommand, {
            expiresIn: 3600,
          });

          return {
            personId: personId,
            similarity: match.Similarity.toFixed(2),
            imageUrl: imageUrl,
          };
        })
      );

      res.status(200).send({
        message: "Matches found!",
        matches: matches, // <-- RETURN AN ARRAY OF MATCHES
      });
    } else {
      console.log("No match found.");
      res.status(404).send({ message: "No match found in the collection." });
    }
  } catch (error) {
    console.error("Error searching for face:", error);
    res.status(500).send({ message: "Internal server error." });
  }
});

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  // Test the AWS connection when the server starts
  await testAwsConnection();
  await createFaceCollection();
});
