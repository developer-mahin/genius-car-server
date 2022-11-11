const express = require("express");
const jwt = require("jsonwebtoken")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config()

// middle ware
app.use(cors());
app.use(express.json());


// user genius-car
// password Nhi86xbFAJI0fD2W



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.blc4w8b.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const servicesCollection = client.db("genius-car").collection("services")
const orderCollection = client.db("genius-car").collection("orders")



function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden  Access" })
        }
        req.decoded = decoded
        next()
    })

}


async function run() {

    try {


    } catch (error) {
        console.log(error.name, error.message);
    }


}

run()


app.post("/jwt", (req, res) => {
    const user = req.body
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10d" })
    res.send({ token })
})


// service api
app.get("/services", async (req, res) => {

    try {
        // const query = { price: { $gt: 150 } }
        // const query = {price: {$lt: 120}}
        // const query = {price: {$eq: 30}}
        // const query = {price: {$gte: 30}}
        // const query = {price: {$in: [30, 20]}}
        // const search 
        // const query = {price: {$ne: 20}}
        const search = req.query.search
        let query = {}
        if (search.length) {
            query = {
                $text: {
                    $search: search
                }
            }
        }
        const order = req.query.order === "asc" ? 1 : -1
        const cursor = servicesCollection.find(query).sort({ price: order })
        const services = await cursor.toArray()
        res.send({
            success: true,
            message: "successfully loaded",
            data: services
        })

    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})

app.get("/services/:id", async (req, res) => {

    try {

        const { id } = req.params;
        const query = { _id: ObjectId(id) }
        const service = await servicesCollection.findOne(query)
        res.send({
            success: true,
            message: "successfully loaded",
            data: service
        })

    } catch (error) {
        res.send(
            {
                success: false,
                error: error.message
            }
        )
    }

})

// order api 
app.get("/orders", verifyJwt, async (req, res) => {
    try {

        const decoded = req.decoded
        if (decoded.email !== req.query.email) {
            res.status(401).send({ message: "Unauthorized access" })
        }

        let query = {}
        if (req.query.email) {
            query = {
                email: req.query.email
            }
        }

        const cursor = orderCollection.find(query)
        const result = await cursor.toArray()
        res.send({
            success: true,
            message: "successfully loaded",
            data: result
        })


    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})

app.post("/orders", async (req, res) => {

    try {

        const query = req.body
        const result = await orderCollection.insertOne(query)
        console.log(result)
        res.send({
            success: true,
            message: "successfully posted",
            data: result
        })

    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }

})

app.delete("/orders/:id", async (req, res) => {
    try {
        const id = req.params.id
        const query = { _id: ObjectId(id) }
        const result = await orderCollection.deleteOne(query)
        res.send({
            success: true,
            message: "successfully delete",
            data: result
        })

    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})

app.patch("/orders/:id", async (req, res) => {
    const id = req.params.id
    const status = req.body.status;
    const query = { _id: ObjectId(id) }
    const updatedDoc = {
        $set: {
            status: status
        }
    }
    const result = await orderCollection.updateOne(query, updatedDoc)
    res.send(result)
})

app.get("/", (req, res) => {
    res.send("server is running")
})

app.listen(port, () => {
    console.log(`App running on port ${port}`);
})