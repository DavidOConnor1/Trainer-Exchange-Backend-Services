import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Mock database (replace with Mongo, PostgreSQL, etc. later)
let users = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' }
];

// Routes
app.get('/users', (req, res) => {
  res.json(users);
});

app.get('/Users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/users', (req, res) => {
  const newUser = { id: Date.now().toString(), ...req.body };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Run service
const PORT = 4000;
app.listen(PORT, () => console.log(`User service running on port ${PORT}`));