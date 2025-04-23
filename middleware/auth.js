const jwt = require('jsonwebtoken')

module.exports = function(req, res, next){
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({error: 'No token, auth deined'});


    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({error: 'Token is not valid'});
    }
}