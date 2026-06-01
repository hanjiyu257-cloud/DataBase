const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ✅ 쿼리(Query) 예시 — 할 일 목록 조회 (JOIN 사용)
app.get('/todos/:userId', async (req, res) => {
  const result = await pool.query(
    'SELECT todos.*, users.username FROM todos JOIN users ON todos.user_id = users.id WHERE todos.user_id = $1 ORDER BY created_at DESC',
    [req.params.userId]
  );
  res.json(result.rows);
});

// ✅ 트랜잭션(Transaction) 예시 — 회원가입 + 기본 할일 동시 생성
app.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userResult = await client.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
      [req.body.username, req.body.password]
    );
    const userId = userResult.rows[0].id;
    
    // 가입 시 기본 할일 자동 생성
    await client.query(
      'INSERT INTO todos (user_id, title) VALUES ($1, $2)',
      [userId, '첫 번째 할 일을 추가해보세요!']
    );
    
    await client.query('COMMIT');
    res.json({ userId, username: req.body.username });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// 로그인
app.post('/login', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE username = $1 AND password = $2',
      [req.body.username, req.body.password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });
    }
    const user = result.rows[0];
    res.json({ userId: user.id, username: user.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 할 일 추가
app.post('/todos', async (req, res) => {
  const result = await pool.query(
    'INSERT INTO todos (user_id, title) VALUES ($1, $2) RETURNING *',
    [req.body.userId, req.body.title]
  );
  res.json(result.rows[0]);
});

// 완료 토글
app.patch('/todos/:id', async (req, res) => {
  const result = await pool.query(
    'UPDATE todos SET is_done = NOT is_done WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  res.json(result.rows[0]);
});

// 삭제
app.delete('/todos/:id', async (req, res) => {
  await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));