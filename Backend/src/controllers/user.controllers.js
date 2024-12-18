import { User } from "../models/user.models.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


export const registerUser = async (req, res) => {
   try {
      const { username, email, password } = req.body;
      console.log(username, email);

      // Check for missing fields
      if ([username, email, password].some((field) => field?.trim() === "")) {
         return res.status(401).json({ message: "All fields are required" });
      }

      // Check if email or username already exists
      const userExists = await User.findOne(email);
      // $or: [{ username }, { email }]

      if (userExists) {
         return res.status(400).json({ message: "User already exists" });
      }

      // Create a new user
      const createdUser = await User.create({
         username,
         email,
         password
      });

      // Fetch user data without password and refreshToken
      const resUser = await User.findById(createdUser._id).select("-password -refreshToken");

      if (!resUser) {
         return res.status(500).json({ message: "Something went wrong" });
      }

      return res.status(201).json(resUser);
   } catch (error) {
      return res.status(500).json({ message: error.message || "Internal Server Error" });
   }
};

const generateAccessTokenAndRefreshToken = async (userId)=>{
    const user = await User.findById(userId);
    
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    
    console.log("AccessToken: ", accessToken);
    console.log("RefreshToken: ", refreshToken);

    user.refreshToken = refreshToken;

    console.log("RefreshToken after assinging in user obj: ", user.refreshToken);

    await user.save({validateBeforeSave: false});

    return {accessToken, refreshToken};
}


export const loginUser = async (req, res)=>{
    // take user credentials from req body
    // check for validation
    // check for user exists or not 
    // check password correct or not
    // generateRefreshToken & generateAccessToken 
    // save refreshToken into user object in db
    // create cookies 
    // return res 


    const {username, email, password} = req.body;
    console.log("Email: ", email);
    console.log("Username: ", username);
    console.log("Password: ", password);

    if(!username && !email){
        return res.status(401).json("username or email required");
    }


    const user = await User.findOne({
        $or: [{username}, {email}]
    });

    if(!user){
        return res.status(404).json("User does not Exists");
    }

    const validatePassword = await user.isPasswordCorrect(password);

    if(!validatePassword){
       return res.status(401).json("Incorrect Credentials, try again");
    }

    const {accessToken, refreshToken} = await generateAccessTokenAndRefreshToken(user._id);

    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken")
   
    console.log("AccessToken Inside function: ", accessToken);
    console.log("RefreshToken Inside function: ", refreshToken);
    console.log(LoggedInUser);
    

    const options = {
      httpOnly: true,
      secure: false, 
      sameSite: 'Lax', 
  };
  
    
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
        "accessToken": accessToken,
        "refreshToken": refreshToken,
        "message": "User LoggedIn Successfully"
    });    
}

export const logoutUser = async (req, res)=>{
   // console.log(req);

   try {  
      await User.findByIdAndUpdate(
         req.user._id,
         {
             $unset: {
                 refreshToken: 1 
             }
         },
         {
             new: true
         }
      );
   
      const options = {
         httpOnly: true,
         secure: false, 
         sameSite: 'Lax', 
     };
     
   
     return res
     .status(200)
     .clearCookie("accessToken", options)
     .clearCookie("refreshToken", options)
     .json(req.user);
  
  } catch (error) {
      console.log("Error encountered here!");
      return res.status(401).json(error.message || "Invalid Access Token!");
  }  
} 

export const refreshAccessTokenAfterExpiry = async (req, res)=>{
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

   if(!incomingRefreshToken){
      return res.status(401).json("Unauthorized Access");
   }

   try{
      const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

      const user = User.findById(decodedToken?._id);

      if(!user){
         return res.status(401).json("Invalid Refresh Token");
      }
      
      console.log(user.refreshToken);
      console.log(req.cookies);
      console.log(user.accessToken);
      console.log("DecodedToken: ",decodedToken);


      console.log(incomingRefreshToken);
      if(incomingRefreshToken!== user?.refreshToken){
         return res.status(401).json("Invalid Refresh Token");                     
      }

      const options = {
         httpOnly: true,
         secure: false, 
         sameSite: 'Lax',
      }

      const {accessToken, newRefreshToken} = generateAccessTokenAndRefreshToken(user._id);

      return res.status(200).cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json("Access Token Refreshed Successfully");

   }catch(error){
      return res.status(401).json(error.message || "Invalid refreshToken");
   }
}

export const changePassword = async (req, res)=>{
   try {
      const {oldPassword, newPassword, confirmPassword} = req.body;
   
      if(newPassword!==confirmPassword){
         return res.status(400).json("Incorrect Password");
      }
   
      const user = await User.findById(req.user?._id);
      
      const isValidPassword = await user.isPasswordCorrect(oldPassword);
   
      if(!isValidPassword){
         return res.status(401).json("Incorrect Old Password Entered, try again");
      }
   
      user.password = newPassword;
      await user.save({validateBeforeSave: false});
   
      return res.status(200).json("Password Changed SuccessFully");
      
   } catch (error) {
      return res.status(401).json(error.message || "Invalid Access");
   }
}


export const changeUsername = async (req, res)=>{
   try {
      const {newUsername, confirmUsername} = req.body;
   
      if(newUsername!==confirmUsername){
         return res.status(400).json("Incorrect Username entered");
      }
   
      const user = await User.findById(req.user?._id);
     
      user.username = newUsername;
      await user.save({validateBeforeSave: false});
   
      return res.status(200).json("Username Changed SuccessFully");
      
   } catch (error) {
      return res.status(401).json(error.message || "Invalid Access");
   }
}
