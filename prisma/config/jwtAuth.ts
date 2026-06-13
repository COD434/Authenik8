import dotenv from "dotenv";
import {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";
import {initializeRedisClient} from "./redis";
import {guestCounter, guestBlocked} from "./Monitor/monitor";
import crypto from "crypto"
dotenv.config();

interface JwtPayload {
userId: string;
email: string;
}

const T_EXPIRY = "1d"
export const guestToken = (): string =>{
const Payload={
type: "guest",
id:crypto.randomUUID(),
createdAt:Date.now()
  }
  //if(guestToken()){
  guestCounter.inc();
  
return jwt.sign(Payload,process.env.JWT_SECRET!,{expiresIn:T_EXPIRY});

}

export const verifyToken = (token:string): any | null=>{
try{
return jwt.verify(token,process.env.JWT_SECRET!);
}catch{
return null;
 }
} 
export const authenticateJWT = async(req:Request, res:Response, next:NextFunction): Promise<void> =>{


	const authHeader = req.headers.authorization;

	const token = req.cookies?.token ||(authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);

if (!token){
 res.status(401).json({message: "Unauthorized"})
return;
}
try{

	const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
	const redisClient = await initializeRedisClient();
	const storedToken = await redisClient.get(`session:${decoded.userId}`);
	if(storedToken !== token){
res.status(403).json({success:false, message: "Invalid session", errors:[]})
return
}
(req as any).user = decoded;
return next()

}catch(err){
res.status(403).json({success: false ,message: "Invalid  or expired token"})
return;
};
}
