import express from "express"
import {SessionData} from "express-session"
import {Router} from "express"
import{Request, Response, NextFunction} from "express";
import {adminController} from "../Controllers/whitelistContrller";
import {dynamicWhiteList, verifyJWT} from "../prisma/config/security";
import * as security from "../prisma/config/security"
import cookieParser from 'cookie-parser';
import {requireAdmin,Incognito, VerificationOfEmail} from "../Controllers/authController"
import {authenticateJWT} from "../prisma/config/jwtAuth"
import {refreshTokenController} from "../prisma/config/refresh"
declare module "express-session"{
interface SessionData{
rateLimit?:{
remaining:number;
resetTime:Date;
   }
   otpData?:{
   email: string;
   otp:string;
   success?:string;
   }
 }
}
const router = Router()
router.use(cookieParser());


export const asyncHandler = (fn:(req:Request, res:Response, next:NextFunction)=>
Promise<any>) => (req:Request, res:Response, next:NextFunction)=>{
Promise.resolve(fn(req, res, next)).catch(next);
}

  router.post("/logout",authenticateJWT ,(req,res)=>{
  res.clearCookie("token").json({success:true, message: "Logged out"})
  })
  router.post("/admin/refresh-token", requireAdmin,authenticateJWT,refreshTokenController)
  router.post("/admin/whitelist/add",requireAdmin,authenticateJWT,adminController.addIP);
  router.post("/admin/whitelist/remove",requireAdmin,authenticateJWT,adminController.removeIP);
  router.get("/admin/whitelist/list",requireAdmin,authenticateJWT,adminController.listIP) 
router.get("/verify-email",VerificationOfEmail())
router.get("/guest-mode",Incognito,(req,res)=>{
	console.log(Incognito)
res.status(200).json({ message:"Guest login successful",
user: (res as any).user,
})
})


export default router;
	        
