const users = require('../services/users');

exports.getUserById = async  (req, res) => {
    const user = await users.getUser(req.params.id)
    if (!user)
        return res.status(404).json({ error: 'User not found' })
    res.json(user).end();
}
exports.createUser = async (req, res) => {
    if (!req.body) return res.status(400).json({ error: "Missing request body" });
    const { name, gender, date, email, password, confPassword, photo } = req.body
    const newUser = await users.createUser(name, gender, date, email, password, confPassword, photo)
    if (newUser.error) {
        if (newUser.type === "badRequest") return res.status(400).json({ error: newUser.error })
        return res.status(404).json({ error: newUser.error })
    }
    res.status(201).location(`/api/users/${newUser.id}`).end()
}
exports.getUserByEmail = async (req, res) => {
    const user = await users.getUserByEmail(req.params.id)
    if (!user)
        return res.status(404).json({ error: 'User not found' })
    res.json(user).end();
}