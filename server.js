// Required packages.
const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
var cookieParser = require('cookie-parser');
const MongoClient = require('mongodb').MongoClient;
const exphbs  = require('express-handlebars');
var path = require('path');
const index = require('./routes/index.js');
const readDB = require('./routes/readDB.js');
const api = require('./routes/api');
// const fetch = require('./public/fetch')

var session = require('express-session');
var RedisStore = require('connect-redis')(session);

let web_array = new Array();
let web_array_str = "";

var Redis = require("ioredis"); //
// var cluster = new Redis(); // only use when not in cluster mode

var cluster = new Redis.Cluster([
    {
        port: 6379,
        host: "172.31.43.44"
    }
]);  // Used for deployed redis cluster access, example

cluster.on('ready', function() {
    console.log('Redis Cluster is Ready.');
});

// cluster.cluster('info', function (err, clusterInfo) {
//     if (err) {
//         console.log('Redis Cluster is not yet ready. err=%j', err);
//         console.log(err.lastNodeError)
//     } else {
//         console.log('Redis Cluster Info=%j', clusterInfo);
//     }
// });

fs.readFile('data.txt', (err, data) => {
    if (err) throw err;
    web_array_str = data.toString();
    web_array = web_array_str.split(",");

    let web_card_url_array = web_array.slice(0,6);
    let right_side_bar_array = web_array.slice(6);

    // Server setup
    const app = express();
    const hbs = exphbs.create({
      layoutsDir: path.join(__dirname, "views"),
      defaultLayout: '',
      extname: 'handlebars'
    });

    app.engine('handlebars', hbs.engine);
    app.set('view engine', 'handlebars');

    app.use(express.static('public'));


    // Database setup
    const DATABASE_NAME = 'webapp';
    const MONGO_URL = `mongodb://localhost:27017/${DATABASE_NAME}`;
    let db = null;
    let collection = null;

    async function startServer() {

      db = await MongoClient.connect(MONGO_URL);

      collection = db.collection('webapp');

      function setDatabases(req, res, next) {
        req.collection = collection;
        req.cluster = cluster;
        next();
      }

      let hour = 3600000;
      app.use(cookieParser());
      app.use(session({
          name: "hailong",
          secret: "news aggregator by people in HaiLong Mansion",
          cookies: {expires: new Date(Date.now() + hour*336)},
          resave: false,
          saveUninitialized: true,
          // store: new RedisStore({
          //     host: '127.0.0.1',
          //     port: 6379,
          //     db: 0,
          // }),
          store: new RedisStore({client: cluster}),
      }));
      // session must be declared BEFORE any routers! otherwise, it won't get registered to routers, would be undefined
      app.use(setDatabases);
      // routers below
      app.use(readDB);
      app.use(index);
      app.use(api);
      // app.use(fetch);


      collection.remove({});
      collection.insert({type: "title", url_array: web_card_url_array, right_side_url: right_side_bar_array});
      await app.listen(3000);
      console.log('Listening on port 3000');
    }
    startServer();




    // Mongo Database related CRUD operations. (create, read, update, delete)//
    /////////////////////////////////////////////////////////////////////
    async function removeElemDB(req, res) {
        const removeFrom = req.body.which;
        const value = req.body.val;

        let db = await collection.find().toArray();
        db = db[0];
        let removeArray = db[removeFrom];
        let id = db._id;

        let filtered = removeArray.filter((elem) => {
            return elem !== value;
        });

        await collection.update({_id: id}, {$set: {[removeFrom]: filtered}});
        res.json({ success: true });  // must have this line, otherwise, this function won't return anything to caller
                                                                                // await waits forever.
    }
    app.post('/db/array/remove', jsonParser, removeElemDB);

    async function addElemDB(req, res) {
        const addTo = req.body.which;
        const value = req.body.val;
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        let db = await collection.find().toArray();
        db = db[0];
        let addToArray = db[addTo];
        addToArray.push(value);
        let id = db._id;


        await collection.update({_id: id}, {$set: {[addTo]: addToArray}});
        // console.log(req.headers.cookie);
        // if(addTo === "url_array") {
        //     console.log(123)
        //     console.log(addTo)
        //     JSON.parse(req.cookies.show_panel).push(value);
        //     res.cookie('show_panel', JSON.stringify(addToArray));
        // }

        console.log(req.session);
        res.cookie('random', 1)  // this works
        res.json({ success: true });  // must have this line, otherwise, this function won't return anything to caller
                                                                            // await waits forever.
    }
    app.post('/db/array/add', jsonParser, addElemDB);


    // async function removeElemCookies(req, res) {
    //
    // }
    // app.post('/cookies/array/remove', jsonParser, removeElemCookies);
    //
    // async function addElemCookies(req, res) {
    //
    // }
    // app.post('/cookies/array/add', jsonParser, addElemCookies);


});