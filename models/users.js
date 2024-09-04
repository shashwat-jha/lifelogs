const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/Learning');

const userSchema = new mongoose.Schema({
    fullname: String,
    username: String,  
    email: String,  
    age: Number,       
    password: String, 
    profilePic: {
        type: String,
        default: '/images/uploads/defaultImage.jpg'
    },
    posts : [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }]
});

module.exports = mongoose.model('User', userSchema);

