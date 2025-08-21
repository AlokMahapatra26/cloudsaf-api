import express from 'express';
import cors from 'cors';
import authRouter from "./routes/auth.routes"
import filesRouter from "./routes/file.routes"
import { authMiddleware } from './middleware/auth.middleware';

const app = express();
const port = 8000; // Port for our backend server

// Middlewares
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/auth', authRouter);
app.use('/api/files' , authMiddleware , filesRouter)

app.get("/" , (req,res)=>{
      res.send("Server is working!");
})

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});