import express from 'express';
import cors from 'cors';
import authRouter from "./routes/auth.routes"
import filesRouter from "./routes/files.routes"
import sharesRouter from "./routes/shares.routes";
import userRouter from './routes/user.routes';
import { authMiddleware } from './middleware/auth.middleware';

const app = express();
const port = 8000; // Port for our backend server

// Middlewares
app.use(cors({
  origin: ["http://localhost:3000", "https://myfrontend.com" , "https://cloudsaf-client.vercel.app"],
  credentials: true,
})); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON bodies

let requestCount = 0;

// middleware to count every request
app.use((req, res, next) => {
  requestCount++;
  console.log(`Request #${requestCount}: ${req.method} ${req.url}`);
  next();
});


// Routes
app.use('/api/auth', authRouter);
app.get('/api/files/shared-with-me', authMiddleware, filesRouter);
app.use('/api/files' , authMiddleware , filesRouter)
app.use('/api/shares' , authMiddleware , sharesRouter)
app.use('/api/user' , authMiddleware , userRouter)

// your routes
app.get("/", (req, res) => {
  res.send(`Hello! This server has received ${requestCount} requests so far.`);
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
