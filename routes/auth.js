const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const auth = require('../middleware/auth')

//Register 
router.post('/register', async (req, res) => {
    try{
        const {name, email, password} = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({name, email, password: hashed});
        res.json(user);
    }
    catch(error){
        res.status(400).json({error: 'Registration failed', details: error.message});
    }
})

router.post('/login', async (req, res) => {
    try{
        const {email, password} = req.body;
        const user = await User.findOne({email});
        if (!user || !(await bcrypt.compare(password, user.password))){
            return res.status(401).json({error: 'Invalid Credentials'});
        }

        const token = jwt.sign({id: user._id }, process.env.JWT_SECRET);
        res.json({token, user: {name: user.name, email: user.email}});
    }
    catch (err){
        res.status(500).json({error: "Login failed", detials: err.message});
    }
})

// protected route 
router.get('/me', auth, async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
});

module.exports = router;