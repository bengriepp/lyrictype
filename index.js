const { response, json } = require('express');
const express = require('express');
const Genius = require("genius-lyrics");
const { readFile, readFileSync } = require ('fs'); 
const { get } = require('http');
const app = express();
const normalize = require('normalize-strings');
const session = require('express-session')
var util = require('util');
const { ArtistsClient, Artist } = require('genius-lyrics');
app.use(express.static(__dirname + '/public'));
app.use(express.json());
const Client = new Genius.Client("WloXn-u-otTEPB95ePT-xtynWzpyZ73Uk0mqBsUXNO39GoLIkfJc01tphA3hk1k3")

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false
}));

normalCharMap = {
    '\xd0\xb5': 'e'
};

async function formatChars(input){
    let output = ""
    for(let i = 0; i < input.length; i++){
        if(["‘", "’", "❛", "❜", "＇"].indexOf(input.charAt(i)) > -1){
            output += "'"
        }
        else if(['“', '”', '‟', '❝', '❞', '〝', '〞', '＂'].indexOf(input.charAt(i)) > -1){
            output += "'"
        }
        else if(['‚'].indexOf(input.charAt(i)) > -1){
            output += ","
        }
        else if(['¡', '¿', '(', ')'].indexOf(input.charAt(i)) > -1){
        }
        else{
            output += input.charAt(i)
        }
    }
    // console.log((normalize(normalize(output), normalCharMap)).toLowerCase())
    return (normalize(normalize(output), normalCharMap)).toLowerCase()
}

app.get('/', (req, res) => {
    readFile('./public/home.html', 'utf8', (err, html) => {
        if(err){
            res.status(500).send('Server Error')
        }
        res.send(html);
    })
});

app.get('/artist/:artist/:and', initSongArray, getArray, sendRes)

async function sendRes(req, res, next){
    res.status(200).json({bruh: 0})
}

async function initSongArray(req, res, next){
    //gets song array with search parameter, returns the 20 most popular songs of artist
    const searches = await Client.songs.search(req.params.artist);
    let songNum = 0
    while((searches[songNum].artist.name.includes('&')) && req.params.and === 0){
        console.log("& detected")
        songNum++;
    }
    const artistTemp = searches[songNum].artist;
    req.session.keystore = artistTemp.client.key
    req.session.apistore = artistTemp.client.api
    req.session.rawstore = artistTemp._raw
    req.session.currPage = 1
    req.session.randSongQueue = []
    req.session.attempts = 0
    next()
}

app.get('/songnum/:num', getArray, getLyrics)

async function getLyrics(req, res){
    try{
        console.log(req.session.attempts)
        req.session.attempts += 1
        const i = req.session.randSongQueue[0]
        req.session.randSongQueue.shift()
        console.log(req.session.randSongQueue)
        const innerClient = new Genius.Client(req.session.keystore)
        const innerArtist = new Artist(innerClient, req.session.rawstore)

        const songArray = await innerArtist.songs({sort: 'popularity', perPage: 1, page: i})
        const lyrics = await formatChars(await songArray[0].lyrics())
        const songInfo = await songArray[0].fetch()
        console.log(songArray[0].artist.name)
        console.log(songInfo.album.name)
        var song = {
            title: songArray[0].title,
            artist: songArray[0].artist.name,
            lyrics: await lyrics,
            album: songInfo.album.name,
            image: songInfo.album.image
        }
        res.status(200).json(song)
    }catch(e){
        console.log(e)
        req.session.randSongQueue.shift()
        console.log(req.session.randSongQueue)
        if(req.session.attempts >= 3){
            var error = {
                "error": "server error",
                "message": "input may be bad"
            }
            return res.status(501).json(error)
        }
        getLyrics(req, res)
    }
}

async function getArray(req, res, next){
    if(req.session.randSongQueue == null || req.session.randSongQueue.length <= 0){
        const innerClient = new Genius.Client(req.session.keystore)
        const innerArtist = new Artist(innerClient, req.session.rawstore)
        const songArray = await innerArtist.songs({sort: 'popularity', perPage: 10, page: req.session.currPage})
        let randSongQueue = []
        for(let i = ((req.session.currPage - 1) * 10) + 1; i < ((req.session.currPage - 1) * 10) + 1 + songArray.length; i++){
            randSongQueue.push(i)
        }
        randSongQueue = shuffleArray(randSongQueue)
        if (songArray.length < 10){
            req.session.currPage = 1
        }else{
            req.session.currPage++
        }
        req.session.randSongQueue = randSongQueue
        console.log(req.session.randSongQueue)
        next()
}
    else{
        next()
    }
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array
}

app.listen(process.env.PORT || 3000, () => console.log(`App available on http://localhost:3000`))



