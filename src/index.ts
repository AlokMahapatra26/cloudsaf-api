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

// Routes
app.use('/api/auth', authRouter);
app.get('/api/files/shared-with-me', authMiddleware, filesRouter);
app.use('/api/files' , authMiddleware , filesRouter)
app.use('/api/shares' , authMiddleware , sharesRouter)
app.use('/api/user' , authMiddleware , userRouter)

app.get("/" , (req,res)=>{
      res.send("Server is working!");
})

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
