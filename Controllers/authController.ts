import dotenv from "dotenv"
import bcrypt  from "bcrypt";
const {PrismaClient} = require ("@prisma/client")
import{ Request, Response, NextFunction} from "express";
import { body, validationResult } from 'express-validator';
import {loginCount, authSuccessCounter, errorCounter} from "../prisma/config/Monitor/monitor"
import {  
sendWelcomeEmail,
SendResetPasswordOTP,
genOTP } from "../prisma/config/email";
import {publishToQueue} from "../prisma/config/Rabbitmq"
import {prisma} from "../prisma/config/validate" 
import {generateJWT} from "../prisma/config/security";
import jwt from "jsonwebtoken";
import {guestCounter ,guestBlocked } from "../prisma/config/Monitor/monitor"
import{initializeRedisClient} from "../prisma/config/redis"
dotenv.config();
import {verifyToken,guestToken}  from "../prisma/config/jwtAuth"


interface credentials{
email:string;
password:string;
username?:string;
id?:string
}

interface LoginCred  {
        email:string;
        password: string;
	resetToken:string
}
interface CustomRequest extends Request{
body:{
email:string;
otp:string;
password?:string;
}
}

interface CustomResponse extends Response{
render:(view : string, locals?: Record<string,any>)=> void;
}

interface PasswordResetResult{
        email:string;     
	resetToken:string;
}

interface MailService {
  //sendVerificationEmail(email: string, token: string) : Promise<void>;
  SendResetPasswordOTP(email: string, token: string) : Promise<void>;
  sendWelcomeEmail(userId: string) : Promise<void>;
  genOTP:any;
}

interface ResponseWithRender extends Response{
redirect:{
(url: string) : void;
(status: number, url: string) : void;
};
}


interface EmailVerificationOptions{
        tokenExpirationCheck?: boolean;
        postVerificationUpdate?:(userId: string) => Promise<void>;
}

interface verificationErrorOptions {
missingTokenMessage?: string;
invalidTokenMessage?: string;
defaultErrorMessage?: string;
                };

interface PasswordResetErrorOptions{
        userNotFoundMessage?:string;
        defaultErrorMessage?:string;
      successMessage?:string;
}

interface VerificationErrorOptions {
  missingTokenMessage?: string;
  invalidTokenMessage?: string;
  defaultErrorMessage?: string;
}

interface PasswordResetOptions {
	  otpExpirationMinutes?: number;
	  otpGenerator?: ()=>string;
	  //include?: Prisma.UserInclude;
}


const createPasswordService ={
       async requestPasswordReset({email,otpExpirationMinutes = 10 }:
                                  {
       email:string,
       otpExpirationMinutes?:number
 

}){
const resetToken = genOTP();
const resetExpires= new Date(Date.now() + otpExpirationMinutes * 60 * 1000)
 
  try{
       const user = await prisma.user.findFirst(
               {where:{email}})
  
 

  
if(!user){
 throw new Error("INVALID_CREDENTIALS");

   }

   

const updatedUser=await prisma.user.update({
where: {id:user.id},
 data:{resetToken, resetExpires},
 })
try{
      console.log(`sending otp ${resetToken} to ${email}`);+
	await publishToQueue("emailQueue",{email, resetToken, userId:user.id})


}catch(err){
console.error("OTP failure:",err);
await prisma.user.update({
where:{id:user.id},
data:{resetToken:null, resetExpires:null},
});
throw new Error("Failed to send OTP") 
}
return updatedUser;

}catch(err){
console.error("Password reset error:",err);
throw err;
 }
 }
 }

//ANONYMOUS AUTH LOGIC
export const Incognito = (req:Request, res:Response, next:NextFunction)=>{
const authHeader = req.headers.authorization;

	let token = authHeader?.split(" ")[1];
        let user = token? verifyToken(token) : null;

if(!user){
const GToken = guestToken();
user = verifyToken(GToken);
res.setHeader("X-Guest-Token",GToken);
guestCounter.inc({endpoint:req.originalUrl});

}
if(user?.type === "guest-mode"){
guestBlocked.inc({endpoint: req.originalUrl, method: req.method})
}
  (res as any).user = user;
  next();
}

const createPasswordErrorHandler=(options?: PasswordResetErrorOptions)=> {

const {
userNotFoundMessage = "INVALID_CREDENTIALS",
defaultErrorMessage = "ERROR_SENDING_OTP",
successMessage =  "Password reset OTP has been sent to your email"
}= options || {};

return(error:Error, res:Response, email?: string)=>{
if(error.message === "INVALID_CREDENTIALS"){
return (res as any).status(400).json({error : defaultErrorMessage})
}

	
	console.error("Password Reset error:",error);
	return (res as any).status(500).json({
		error:defaultErrorMessage
	})
}
}



const HandlePasswordError=createPasswordErrorHandler({
	userNotFoundMessage: "INVALID_CREDENTIALS",
        successMessage:"OTP sent to your email"
})

const requestPassword = async (req:Request, res:Response , next:NextFunction)=>{
const {email} = req.body;

if(!email){
return res.status(400).json({
success:false,
message:"Email is required"})
}

	try{
await createPasswordService.requestPasswordReset({email});

               res.status(200).json({
               success:true,
               message:` reset OTP has been sent to ${email}`
               });

}catch (err){
	if(err instanceof Error){
return HandlePasswordError(err, res, email);
  }else{
  return HandlePasswordError(new Error (String(err)),res,email)
  }
 }
}
const verifyResetOTP = async (req:Request,res:Response, next:NextFunction)=>{

try{
   const{email, otp}= req.body;
    const user = await prisma.user.findUnique({
      where:{
        email,
        resetToken:otp,
        resetExpires:{gt:new Date()}
      }
    })

    if(!user){
       return res.status(400).json({error: "Invalid or expired OTP", email});
	    }
return res.status(200).json({success:true, message:"OTP verified,Please enter your new password"});
  }catch(err){
const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({message: errorMessage})
  }
};

//Update password
export const UpdatePassword = async(req:Request,res:Response ,next:NextFunction)=>{
  const {email,password}=req.body;
 
        if(!email || !password ){
  return res.status(400).json({
  success:false,
  message:"Email,password are required"})
  }
        try{
    const hashed = await bcrypt.hash(password,10)
    const user = await prisma.user.findFirst({
      where:{email}
    })
    if(!user){
        res.status(400).json({
        success:false,
        message:"Huh! you sure your have an account"});

        return;
    }

    await prisma.user.update({
      where:{email},
      data:{
        password:hashed,
        resetToken:null,
        resetExpires:null
        }
    })
    res.status(200).json({
    success:true,
    message:"Success!"})
 return;

  }catch(err){
   console.error("Password update error:",err)

    res.status(500).json({
    success:false,
    message:"Internal server error"});

    return;
  }
};


const registerValidations =({
minPasswordLength= 8,
strongPasswordOptions={
minLength : 12,
minLowercase:1,
minNumbers: 1,
minSymbols: 1,
minUppercase: 1
},
usernameRegex= /^[a-zA-Z0-9_-]+$/
} = {}) => [
  body("email")
    .normalizeEmail()
    .isEmail()
    .withMessage("Invalid email")
    .custom(async (email:string) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        throw new Error("User with that email already exists, want to login?");
      }
      return true;
    }),
  body("username")
    .matches(usernameRegex)
    .trim()
    .escape()
    .notEmpty()
    .withMessage("Username is required"),
  body("password")
    .isStrongPassword(strongPasswordOptions)
    .withMessage("Password must include at least one lowercase, uppercase, number and symbol")
    .trim()
    .escape()
    .isLength({ min: minPasswordLength })
    .withMessage(`Password must be at least ${minPasswordLength} long`),
	
];
const Authservice= {
async registerUser({
email,
password,
username,
tokenExpiryHours = 24,
bcryptRounds = 10
}:{
	email:string;
	password:string;
	username:string;
	tokenExpiryHours?: number;
	bcryptRounds?: number;
}) {
	const verifyToken = genOTP()
	const verifyExpires = new Date(Date.now() + tokenExpiryHours * 60 * 60 * 1000);
	const hashedPassword = await bcrypt.hash(password, bcryptRounds);
	console.log("hashedPassword:",hashedPassword)
	const user = await prisma.user.create({
		data:{
		email,
		password:hashedPassword,
		username,
		isVerified:false,
		verifyToken,
		verifyExpires
		}
	})
	
	try{
		await publishToQueue("emailQueue",{email,verifyToken});

	}catch(emailError){
	console.error("Email send failure:",emailError);
	throw new Error("Failed to send verification email");
	}
	return user;
} 
}
 const userValidations = registerValidations();

 const register = async (req:Request, res:Response ,next:NextFunction) => {

	 const errors = validationResult(req);
  if (!errors.isEmpty()) {

     
	  res.status(400).json({
	success:false,
      validationErrors: errors.array()
    })
			 
	return;	
  }

  try {
    const { email, password, username } = req.body;
     await Authservice.registerUser({email,password,username})
       res.status(200).json({
	success:true,
        message: "Registration successful! Please check your email to verify your account."
      
       });
    console.log("sent  JSON response");
  } catch (err) {
    console.error("Registration error:", err);
     res.json({
      success:false,
      message:  "Registration failed. Please try again" ,
      formData: req.body
    });
  }
};

const loginValidations =({
minUsernameLength = 5,
requireUsername = false
} = {}) =>[
	
  body("email")
.isEmail()
.normalizeEmail()
.withMessage("Invalid email")
.bail(),
  body("password").
trim()
.bail()
.notEmpty()
.withMessage("Password is required"),
body("username")
.optional({checkFalsy: !requireUsername})
.isLength({min: minUsernameLength})
.withMessage(`Username must have atleast ${minUsernameLength} characters`),
];
 const vAL =(req: Request, res:Response,next: NextFunction)=>{
    const errors= validationResult(req);
    if(!errors.isEmpty()){
       res.status(400).json({
        success:false,
        errors:errors.array()
      })
    }
    next();
  }


const authServiceLogin = {
async loginUser(credentials:{
email:string,
password:string,
username?:string
}){
	const {email, password} = credentials;
	const user = await prisma.user.findFirst({where: { email}})
if (!user || !user.password || typeof user.password !== "string" || !user.password.startsWith("$2b$")){
	throw new Error("INVALID_EMAIL")

	}


	let isValidPassword = false;

try{
	isValidPassword = await bcrypt.compare(password,user.password)


}catch(err){
console.error("bcrypt.compar faled or timed out",err)
throw new Error("INVALID_PASSWORD")
}

	console.log("passwords commpare",user.password)
if (!isValidPassword){
throw new Error("INVALID_EMAIL")
}
return user;
}
};

const handleLoginError = (
	error:Error,
	res: Response,
	formValues:{email?: string; username?: string; password?:string} = {}
)=>{
	const{email, password, username} = formValues;
	
	switch(error.message){
		case "INVALID_EMAIL":
			return res.status(400).json({
			errors:[{
			param:"email",
			msg:"Email not found ,want to register"}],
			values: formValues
			});
		case "INVALID_PASSWORD":
			return res.status(400).json({
			error: "Incorrect Password",
			field:"password",
			values:formValues
			});
		default:
			console.error("Login error", error);
			return res.status(400).json({
			success: false,
			error: "Login failed",
			values:formValues
			});
	}
};
 const Lvalidations = loginValidations();

const login = async (req: Request, res: Response)=>{
const {email,password, username}=req.body;
  try {
	  loginCount.inc();
    const user = await authServiceLogin.loginUser({email, password, username});
    if (!user){
    errorCounter.inc();
    res.status(400).json({success:false,message: "Incorrect username or email"})
    }
    
    const token = generateJWT({ userId: user.id,email:user.email })
    
    const redisClient = await initializeRedisClient();

 const accessToken = jwt.sign({userId:user.id, email:user.email ,role:user.role},
process.env.JWT_SECRET!,
{expiresIn:"15m"}
);
const refreshToken= jwt.sign({userId:user.id, email:user.email},
process.env.JWT_REFRESH_SECRET!,
{expiresIn:"7d"})

await redisClient.set(`refresh:${user.id}`,refreshToken, "EX", 7 * 24 * 60 * 60 )
await redisClient.set(`session:${user.id}`,accessToken,"EX",15 * 60 );

res.cookie("token", accessToken, {
httpOnly:true,
secure: process.env.NODE_ENV === "production",
sameSite: "strict",
maxAge: 15 * 60 * 1000,
})


.status(200).json({
	success: true,
	message: "Login Successful",
	user:{
        id:user.id,
        email: user.email,
        username:user.username,
	accessToken,
	refreshToken
                }
                       })
  }catch(error){
          if(error instanceof Error){
		  errorCounter.inc()
  return handleLoginError(error as Error, res, {email,username})
  }
}
}

const createEmailVerificationService=(
	prisma:typeof PrismaClient,
	options:EmailVerificationOptions= {}
) => {
	const {
		tokenExpirationCheck= true,
		postVerificationUpdate = async () => {}
	} = options
	return{
		async verifyEmailToken(token: string){
			if (!token) throw new Error ("MISSING_TOKEN");
			
			const whereClause={
				verifyToken: token,
				...(tokenExpirationCheck && {verifyExpires:{gt:new Date() }
			})
			}
			const user = await prisma.user.findFirst({
				where:whereClause
			})
			if(!user)throw new Error("INVALID_OR_EXPIRED_TOKEN");

			const updatedUser = await prisma.user.update({
				where:{id: user.id},
			data:{
			isVerified: true,
			verifyToken:null,
			verifyExpires:null
			}
			});
			await postVerificationUpdate(user.id);

			return updatedUser
		},
	}
}
		 
export const VerificationOfEmail =  (options?:VerificationErrorOptions)=>{
		const{
		missingTokenMessage="Invalid verification links",
		invalidTokenMessage="Invalid or Expired verifcation link",
		defaultErrorMessage="Email verification failed"
}= options || {};

		

		const emailVerificationService =  createEmailVerificationService(prisma,{tokenExpirationCheck: process.env.NODE_ENV !== "test",
		postVerificationUpdate:async (userId:string)=>{
			try{
		await Promise.all([
		sendWelcomeEmail(userId),
		//addToMailingList(userId)
		]);
		}catch(error){
		console.error("Non-critical post-verification steps failed",error)
}
	}
		})
const handleVerificationError = (error: Error, res: Response): void => {
  switch(error.message) {
    case "MISSING_TOKEN":
      res.status(400).json({ message: "Invalid verification link" });
      break;
    case "INVALID_OR_EXPIRED_TOKEN":
      res.status(400).json({ message: "Expired link" });
      break;
    default:
      res.status(500).json({ message: "Verification failed"});
  };
};
return  async (req:Request, res:Response , next:NextFunction)=> {
const {token}= req.query as {token: string}

	try{
await emailVerificationService.verifyEmailToken(token as string);
res.json({success: true ,message:"Successfully Verified"})
}catch(err){
	if(err instanceof Error){
handleVerificationError(err,res)
	}else {
	console.error("Unexpected error type",err);
	handleVerificationError(new Error(String(err)),res)

	}
    }

  }
}
export const requireAdmin=(req:Request, res:Response,next:NextFunction)=>{
const authHeader = req.headers.authorization || req.cookies.token;

if(!authHeader){
res.status(401).json({error:"Unauthorized:No token provided"})
return;
}
const token= authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
try{
	const decoded = jwt.verify(token,process.env.JWT_SECRET!) as any;
	if(decoded.role !== "ADMIN"){
	return res.status(403).json({error:"Forbidden: Admin only"})
	}
//const user = (req as any).user;
//if(!user || user.role !==" ADMIN"){
//res.status(403).json({success:false,message:"Admin access required"})
//return;
//}


return next();
}catch(error){
res.status(401).json({error:"Invalid or expired token"})
}
}

export {
register,
login,
requestPassword,
verifyResetOTP,
userValidations,
Lvalidations,
vAL
};
