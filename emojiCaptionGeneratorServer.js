process.stdin.setEncoding("utf8");

const http = require("http");
const path = require("path");
const express = require("express"); 
const bodyParser = require("body-parser");
const app = express();
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') })  
const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection:process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(bodyParser.urlencoded({extended:false}));

if(process.argv.length != 3) {
    process.stdout.write(`Usage ${process.argv[1]} targetLanguage`);
    process.exit(1);
}

const portNumber = process.argv[2];

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.get("/", (request, response) => {
    response.render("welcome");
    });

app.listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`);

app.get("/create", (request, response) => {
    const link = `http://localhost:${portNumber}/results`;
    response.render("information", {formAction: link});
    });

app.post("/results", async (request, response) => {
    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
        let user1 = {
            userId: request.body.userId, 
            keyword1: request.body.keyword1, 
            keyword2: request.body.keyword2, 
            keyword3: request.body.keyword1
        };

        let emojiString = "";
        const emojis = await findEmojis(user1);
        if(emojis.length = 3) {
            emojis.forEach(emoji => {
                emojiString += emoji;
            });
        } else {
            emojiString += "No emoji found for keyword"
        }

        let user = {
            userId: request.body.userId,
            keywords: `${user1.keyword1}, ${user1.keyword2}, ${user1.keyword3}`,
            emojiSet: emojiString
        }

        await insertUser(client, databaseAndCollection, user);

        const variables = {
            emojiSet: user.emojiSet,
        }
        response.render("newResults", variables);
    } catch (e) {
        console.error(e);
    }  finally {
        await client.close();
    }
});

app.get("/reviewCreations", (request, response) => {
    const link = `http://localhost:${portNumber}/prevResults`;
    response.render("previousResults", {formAction:link}); 
    });  

app.post("/prevResults", async (request, response) => {
    try {
        const arr = await lookUpMany(request.body.userId);
        let tbl = "<style> table, td, th {border: 1px solid black};</style>"
        tbl += "<table><tr><th><b>Keywords</b></th><th>Emoji Set</th></tr>";
        arr.forEach(user => {
            tbl += `<tr><td>${user.keywords}</td><td>${user.emojiSet}</td></tr>`;
        });
        tbl += "</table>";
        response.render("reviewPrevResults", {displayTable: tbl} )
    } catch(e) {
        console.error(e);
    }
});

async function insertUser(client, databaseAndCollection, newApplicant) {
    await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newApplicant);
}

async function lookUpMany(userId) {
    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
        let filter = {userId : { $regex: userId}};
        const cursor = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);
        return await cursor.toArray();
    } finally {
        await client.close();
    }
}

async function findEmojis(user) {
    try {
        const response = await fetch('https://emojihub.yurace.pro/api/all');
        const allEmojis = await response.json();
        let result = [];
        for (const emoji of allEmojis){
            if(result.length < 3) {
                if(emoji.name.includes(user.keyword1.toLowerCase()) 
                || emoji.name.includes(user.keyword2.toLowerCase())
                || emoji.name.includes(user.keyword3.toLowerCase())) {
                    result.push(emoji.htmlCode);
                }
            }
            else {
                break;
            }
        }
        return result;
    } catch(error) {
        return [];
    }
}