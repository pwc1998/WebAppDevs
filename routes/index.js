const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();


// Constants (magic number) definition
const numOfRightUrls = 8;
const numOfLeftUrls = 12;

// Variables definitions
let urls = "";
let urls_array = new Array();

let righturls = "";
let righturls_array = new Array();

let dic_url_suburl = new Array();
let dic_suburl_title = new Array();
let dic_url_title = new Array();
//let title_array = new Array();



// Display the main page ('/')
async function onViewIndex(req, res) {
    let cluster = req.cluster;  // redis cluster definition

    // TODO: handle login and add user name to session.
    // TODO: log out session status handling
    req.session.userID = "TODO";
    let isLoggedIn = 0;
    req.session.isLoggedIn = isLoggedIn;  // represent not logged in

    // check client side brwoswer cookie
    let session = undefined;
    let renderDefault = 1;
    if(req.cookies.sid) {  // sid exists
        session = await cluster.get('sess:' + req.cookies.sid);
        if(session) {  // previous session exists, can restore previous cards
            console.log("Returning user, successfully located session data in redis");
            console.log(session);
            renderDefault = 0;  // dont render default
            // Restore session:
            // 1. determine login state
            // 2. populate display arrays (outside this if checks)
            if(session.isLoggedIn === 0){
                // not logged in
            }
            else if(session.isLoggedIn === 1) {
                // is logged in
            }
            else {
                // should not happen
                // TODO: handle errors!!
            }
        }
        else {
            console.log("sid not present in redis, should NOT happen!! (probably redis is flushed)");
            // TODO: handle this error case.
        }
    }
    else {  // sid does not exist, render default
        console.log("Welcome new user, cookies sid not present");
    }

    // await cluster.set('foo', 'bar')


    // in server, we call setCollection, which defines req.collection = collection (which is our mongodb database)
    const a = await req.collection.find().toArray();
    // populate urls(cards view), and righturls(websites on the right to be added to the left)
    // from mongodb, (specific for each user in the future).
    // render default! // always.
    for (let b of a) {
        urls = `${b.url_array}`;
        righturls = `${b.right_side_url}`
    }
    if (urls !== "") {
        urls_array = urls.split(",");
    } else {
        urls_array = [];
    }
    if (righturls !== "") {
        righturls_array = righturls.split(",");
    } else {
        righturls_array = [];
    }

    if( !renderDefault ) {  // renderDefault !==0
        // don't render default, decide whether logged in
        if(isLoggedIn && !req.cookies.show_panel) {  // no show panel, get from database, for good efficiency
            // TODO:   get Mongo DB stuff
        }
        else if( req.cookies.show_panel ) {
            // get cookie's show_panel
            // and produce corresponding right array
            righturls_array = righturls_array.concat(urls_array);
            urls_array = JSON.parse(req.cookies.show_panel);

            // filter the rigth array, getting rid of left card source domains
            for(url of urls_array) {
                righturls_array = righturls_array.filter((elem) => {
                    return elem !== url;
                });
            }
        }
        else {
            // should not happen
            // TODO: handle errros!!
        }
    }

    if(urls_array){
        for(let i = 0; i < urls_array.length; i++){
            let subs = await cluster.smembers('updated_hrefs_' + urls_array[i]);
            let sub_url_array = subs.slice(0, numOfLeftUrls);
            for(let j = 0; j < sub_url_array.length; j++){
                let title = await cluster.get('updated_hrefs_title_' + sub_url_array[j]);
                if(title === null){
                    dic_suburl_title[sub_url_array[j]] = sub_url_array[j];
                }else{
                    dic_suburl_title[sub_url_array[j]] = title;
                }
            }
            dic_url_suburl[urls_array[i]] = sub_url_array;

            subs = await cluster.smembers('last_all_hrefs_' + urls_array[i]);
            sub_url_array = subs.slice(0, numOfLeftUrls);
            for(let j = 0; j < sub_url_array.length; j++){
                let title = await cluster.get('updated_hrefs_title_' + sub_url_array[j]);
                if(title === null){
                    dic_suburl_title[sub_url_array[j]] = sub_url_array[j];
                }else{
                    dic_suburl_title[sub_url_array[j]] = title;
                }
            }
            dic_url_suburl[urls_array[i]] = sub_url_array;
        }

    }

    if(righturls_array){
        for(let i = 0; i < righturls_array.length; i++){
            let right_title = await cluster.get('updated_hrefs_title_' + righturls_array[i]);
                dic_url_title[righturls_array[i]] = right_title;
        }
    }



    // populate webpages json array, where each element is a JSON containing info to be passed to handlebar template
    var webpages = [];
    if(urls_array !== undefined && urls_array !== null && urls_array.length !== 0) {
        webpages = [];
        try{
            for await(url of urls_array) {
                let mainSite = url;
                let websiteName = webName(url);
                let subSites = [];
                let counter = 0;
                if(dic_url_suburl[url]){
                    for await (subsiteUrl of dic_url_suburl[url]) {
                        // console.log(subsiteUrl);
                        let one = {
                            "title": dic_suburl_title[subsiteUrl],
                            "url": subsiteUrl
                        };
                        subSites.push(one);
                        counter++;
                        if(counter >= numOfLeftUrls) {
                            break;
                        }
                    }
                }
                let entry = {
                    "mainSite": mainSite,
                    "siteName": websiteName,
                    "subSites": subSites
                };
                //console.log(entry);
                webpages.push(entry);
            }
        }catch (e){
            console.error("delay");
        }
    }

    let sideWebpages = [];
    if(righturls_array !== undefined && righturls_array !== null && righturls_array.length !== 0 && righturls.length!==0) {
        sideWebpages = [];
        try{
            let counter = 0;
            for await(righturl of righturls_array) {
                let mainSite = righturl;
                let websiteName_right = webName(righturl);
                let side_title = dic_url_title[righturl];

                let entry = {
                    "mainSite": mainSite,
                    "siteName": websiteName_right,
                    "title": side_title
                };
                //console.log(entry);
                if(counter >= numOfRightUrls) break;
                sideWebpages.push(entry);
                counter++;
            }
        }catch (e){
            console.error("delay");
        }
    }

    // console.log(sideWebpages);
    const placeholders = {
        cards: webpages,
        lists: sideWebpages,
    };
    if(!req.cookies.sid) {
        res.cookie('sid', req.session.id, { maxAge: 3600000 * 672, singed: true});  // session id (a month time)
    }
    if(!req.cookies.show_panel) {
        res.cookie('show_panel', JSON.stringify(urls_array));  // a method to put array in cookie (requires corresponding get)
    }

    res.render('index', placeholders);
}
router.get('/', onViewIndex);

//https://rickmanelius.com/   -> com/
function webName(siteName){
    let result = siteName.substring(0,siteName.length-5);
    //http
    if(result.substring(0,8) === "https://"){
        result = siteName.substring(8, result.length);
    }else if(result.substring(0,7) === "http://"){
        result = siteName.substring(7, result.length);
    }else{
        result = result;
    }
    if(result.substring(0,3) === "www"){
        result = result.substring(4, result.length);
    }else if(result.substring(0,4) === "blog"){
        result = result.substring(5, result.length);
    }else{
        result = result;
    }
    return result;
}

module.exports = router;
