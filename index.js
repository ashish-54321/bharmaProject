// Backend (Node.js + Express + MongoDB)
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({
    email: String,
    password: String,
    categories: [String]
});

const User = mongoose.model('User', UserSchema);

app.post('/signup', async (req, res) => {
    const { email, password, categories } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, categories });
    await user.save();
    res.json({ message: 'User registered successfully' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

app.get('/articles', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ error: 'User not found' });

        let allArticles = [];
        for (const category of user.categories) {
            try {
                const response = await axios.post('https://google.serper.dev/search', {
                    q: category,
                    num: 5
                }, {
                    headers: {
                        'X-API-KEY': process.env.SERPER_API_KEY,
                        'Content-Type': 'application/json'
                    }
                });

                const articles = response.data.organic.map(item => ({
                    title: item.title,
                    link: item.link,
                    category,
                    publishedAt: new Date()
                }));

                allArticles = [...allArticles, ...articles];
            } catch (error) {
                console.error(`Error fetching articles for ${category}:`, error.message);
            }
        }

        res.json(allArticles);
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.listen(5000, () => console.log('Server running on port 5000'));
