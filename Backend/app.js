const express = require('express')
var app = express()

const users = require('./routes/users');

const bodyParser = require('body-parser');
const cors = require('cors');
// const mongoose = require('mongoose');
//for jwt
const jwt = require("jsonwebtoken")

// require('custom-env').env(process.env.NODE_ENV, './config');
// mongoose.connect(process.env.CONNECTION_STRING,
//     {
//         useNewUrlParser: true,
//         useUnifiedTopology: true
//     });

app.use(cors());
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: true }));

//for upload photo limit
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/users', users);

/*  *///enable reading the json in good format
app.set('json spaces', 2);
app.listen(process.env.PORT);