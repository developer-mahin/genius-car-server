const express = require("express");
const jwt = require("jsonwebtoken")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const SSLCommerzPayment = require('sslcommerz-lts')
require("dotenv").config()

// middle ware
app.use(cors());
app.use(express.json());


// user genius-car
// password Nhi86xbFAJI0fD2W

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false //true for live, false for sandbox


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.blc4w8b.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });





function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        const servicesCollection = client.db("genius-car").collection("services")
        const orderCollection = client.db("genius-car").collection("orders")

        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
            res.send({ token });
        });

        app.get("/services", async (req, res) => {
            // const search = req.query.search;
            const query = {};
            // if (search.length) {
            //     query = {
            //         $text: {
            //             $search: search
            //         }
            //     };

            // }
            // const query = { price: { $gt: 100, $lt: 300 } }
            // const query = { price: { $eq: 200 } }
            // const query = { price: { $lte: 200 } }
            // const query = { price: { $ne: 150 } }
            // const query = { price: { $in: [20, 40, 150] } }
            // const query = { price: { $nin: [20, 40, 150] } }
            // const query = { $and: [{price: {$gt: 20}}, {price: {$gt: 100}}] }
            // const order = req.query.order === "asc" ? 1 : -1;
            // const cursor = servicesCollection.find(query).sort({ price: order });
            const cursor = servicesCollection.find(query)
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get("/services/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const service = await servicesCollection.findOne(query);
            res.send(service);
        });


        // orders api
        app.get("/orders", verifyJWT, async (req, res) => {
            const decoded = req.decoded;

            if (decoded.email !== req.query.email) {
                res.status(403).send({ message: "unauthorized access" });
            }

            let query = {};
            if (req.query.email) {
                query = {
                    email: req.query.email
                };
            }
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        app.post("/orders", verifyJWT, async (req, res) => {
            const order = req.body;

            const { currency, customer, email, address, city, zip_code, state, phone } = order;
            if (!currency || !customer || !email || !address || !city || !zip_code || !state || !phone) {
                return res.redirect(`http://localhost:3000/payment/fail`)
            }

            const query = { _id: ObjectId(order.service) }
            const orderedService = await servicesCollection.findOne(query)
            const transactionId = (new ObjectId()).toString()

            const data = {
                total_amount: orderedService.price,
                currency: order.currency,
                tran_id: transactionId, // use unique tran_id for each api call
                success_url: `http://localhost:5000/payment/success?transactionId=${transactionId}`,
                fail_url: 'http://localhost:5000/payment/fail',
                cancel_url: 'http://localhost:5000/payment/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: orderedService.title,
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: order.customer,
                cus_email: order.email,
                cus_add1: order.address,
                cus_add2: 'Dhaka',
                cus_city: order.city,
                cus_state: order.state,
                cus_postcode: order.zip_code,
                cus_country: 'Bangladesh',
                cus_phone: order.phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };


            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                orderCollection.insertOne({
                    ...order,
                    price: orderedService.price,
                    transactionId,
                    paid: false
                })
                res.send({ url: GatewayPageURL })
            });
        });

        app.post("/payment/success", async (req, res) => {
            const { transactionId } = req.query;
            if (!transactionId) {
                return res.redirect(`http://localhost:3000/payment/fail`)
            }
            const result = await orderCollection.updateOne({ transactionId }, {
                $set: {
                    paid: true,
                    paidArt: new Date()
                }
            })
            if (result.modifiedCount > 0) {
                res.redirect(`http://localhost:3000/payment/success?transactionId=${transactionId}`)
            }
        })

        app.post("/payment/fail", async (req, res) => {
            const { transactionId } = req.params;
            const result = await orderCollection.deleteOne({ transactionId })
            if (result.deletedCount) {
                res.redirect(`http://localhost:3000/payment/fail`)
            }
        })

        app.get("/order/by-transaction-id/:id", async (req, res) => {
            const { id } = req.params;
            const query = { transactionId: id }
            const result = await orderCollection.findOne(query)
            res.send(result)
        })

        app.patch("/orders/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const query = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: status
                }
            };
            const result = await orderCollection.updateOne(query, updatedDoc);
            res.send(result);
        });

        app.delete("/orders/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });


    }
    finally {

    }

}

run().catch(err => console.error(err));




app.get("/", (req, res) => {
    res.send("server is running")
})

app.listen(port, () => {
    console.log(`App running on port ${port}`);
})