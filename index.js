const express = require('express')
require('dotenv').config()
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const cors = require('cors')



// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.egyokrx.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    const db = client.db('competexDB');
    const userCollections = db.collection('user');
    const contestCollections = db.collection('contest');
    const enrollCollections = db.collection('enroll');




    // Users Api

    app.get('/users', async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const userInfo = req.body;
      userInfo.createdAt = new Date();

      const email = userInfo.email;
      const uesrExisted = await userCollections.findOne({ email })


      if (uesrExisted) {
        return res.send({ message: "User already existed" })
      }
      const result = await userCollections.insertOne(userInfo);
      res.send(result);
    })




    // Contest Related API


    app.get('/all-contests', async (req, res) => {
      const query = { status: 'approved' }
      const result = await contestCollections.find(query).toArray();
      res.send(result);
    })
    app.get('/top-contests', async (req, res) => {
      const query = { status: 'approved' }
      const result = await contestCollections.find(query).sort({ participantCount: -1 }).limit(3).toArray();
      res.send(result);
    })


    app.get('/contest/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = { _id: new ObjectId(id) };
      const result = await contestCollections.findOne(cursor);
      res.send(result)
    })

    app.post('/contest', async (req, res) => {
      const contestInfo = req.body;
      const result = await contestCollections.insertOne(contestInfo)
      res.send(result);
    })


    // Search Contest

    app.get('/contests', async (req, res) => {
      const searchText = req.query.search;
      const query = {};
      if (searchText) {
        query.$or = [
          {
            name: { $regex: searchText, $options: 'i' }
          }
        ];
      }
      const result = await contestCollections.find(query).sort({ createdAt: -1 }).limit(3).toArray();
      res.send(result);
    })

    app.get('/my-contests', async (req, res) => {
      const email = req.query.email;
      const query = { createdBy: email }
      const result = await contestCollections.find(query).toArray();
      res.send(result);
    })

    app.get('/contests/pending', async (req, res) => {
      const query = { status: 'pending' };
      const result = await contestCollections.find(query).toArray();
      res.send(result)
    })

    app.patch('/contest/approved/:id', async (req, res) => {
      const { id } = req.params;
      const updateDoc = {
        $set: { status: 'approved' }
      };
      const query = { _id: new ObjectId(id) }
      const result = await contestCollections.updateOne(query, updateDoc);
      res.send(result);
    })
    app.patch('/contest/denied/:id', async (req, res) => {
      const { id } = req.params;
      const updateDoc = {
        $set: { status: 'denied' }
      };
      const query = { _id: new ObjectId(id) }
      const result = await contestCollections.updateOne(query, updateDoc);
      res.send(result);
    })


    app.post('/enroll-contest/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { participantEmail } = req.body;

        const contest = await contestCollections.findOne({
          _id: new ObjectId(id)
        });

        if (!contest) {
          return res.status(404).send({ message: "Contest not found" });
        }

        if (contest.creatorEmail === participantEmail) {
          return res.status(403).send({
            message: "Creators cannot participate in their own contests."
          });
        }

        const alreadyEnrolled = await enrollCollections.findOne({
          contestId: id,
          participantEmail
        });

        if (alreadyEnrolled) {
          return res.status(400).send({
            message: "You have already enrolled in this contest."
          });
        }

        const enrollmentDoc = {
          contestId: id,
          participantEmail,
          enrolledAt: new Date(),
          status: "active"
        };

        const result = await enrollCollections.insertOne(enrollmentDoc);

        await contestCollections.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { participantCount: 1 } }
        );

        res.send({
          success: true,
          message: "Enrollment successful",
          insertedId: result.insertedId
        });

      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get('/isEnrolled', async (req, res) => {
      const email = req.query.email;
      const query = { participantEmail: email }
      const result = await enrollCollections.find(query).toArray();
      res.send(result)
    })


    // Get all contests a specific user is enrolled in, including full contest details
    app.get('/my-enrolled-contests', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const result = await enrollCollections.aggregate([
          {
            // 1. Filter by participant email
            $match: { participantEmail: email }
          },
          {
            // 2. Convert contestId (string) to ObjectId to match with contest._id
            $addFields: {
              contestObjectId: { $toObjectId: "$contestId" }
            }
          },
          {
            // 3. Join with the contest collection
            $lookup: {
              from: "contest",           // The target collection name
              localField: "contestObjectId",
              foreignField: "_id",
              as: "contestDetails"
            }
          },
          {
            // 4. Flatten the contestDetails array into an object
            $unwind: "$contestDetails"
          },
          {
            // 5. Cleanup: Remove the temporary ObjectId field
            $project: {
              contestObjectId: 0
            }
          }
        ]).toArray();

        res.send(result);
      } catch (error) {
        console.error("Aggregation Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    app.get('/submit-content/:courseId', async(req,res)=> {
      const id = req.params.courseId;
      const query = {_id: new ObjectId(id)};
      const result = await contestCollections.find(query).toArray();
      res.send(result)
    })


    













    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World from compete-x server')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})




