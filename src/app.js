import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();

app.use(express.json());
app.use(cors());
dotenv.config();

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (err) {
  console.log(err);
}

const participantSchema = joi.object({
  name: joi.string().required().min(3),
});

const messagesSchema = joi.object({
  from: joi.string().required().min(3),
  to: joi.string().required().min(3),
  text: joi.string().required(),
  type: joi.string().required().valid("message", "private_message"),
});

app.post("/participants", async (req, res) => {
  const name = req.body.name;

  const validation = participantSchema.validate({ name });

  if (validation.error) {
    const error = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(error);
  }

  try {
    const alreadyExists = await db.collection("participants").findOne({ name });

    if (alreadyExists) {
      return res.sendStatus(409);
    }

    await db
      .collection("participants")
      .insertOne({ name, lastStatus: Date.now() });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participantsList = await db
      .collection("participants")
      .find()
      .toArray();

    res.status(200).send(participantsList);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;

  const validation = messagesSchema.validate({ from, to, text, type });
  if (validation.error) {
    const error = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(error);
  }

  try {
    const fromExists = await db
      .collection("participants")
      .findOne({ name: from });

    if (!fromExists) {
      return res.sendStatus(422);
    }

    await db.collection("messages").insertOne({
      from,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/messages", async (req, res) => {
  const participant = req.headers.user;
  const limit = parseInt(req.query.limit);

  if (limit <= 0) {
    return res.sendStatus(422);
  }

  try {
    const teste = await db
      .collection("messages")
      .find({ $or: [{ from: participant }, { to: participant }] })
      .toArray();

    if (limit) {
      return res.status(200).send(teste.slice(-limit));
    }

    res.status(200).send(teste);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
