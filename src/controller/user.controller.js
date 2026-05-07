import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { Subscription } from "../models/subscription.model.js"
 const registerUser= asyncHandler(async(req,res)=>{
    //get user details from frontend
const {fullName,email,userName,password}=req.body 
console.log("email:",email)


    //validation- not empty
    if ([fullName,email,userName,password].some((field)=>{
    field?.trim()===""
})) {
    throw new ApiError(400,"All fields are required")
    
}
    //check if user already exists -username email
    const existedUser = await User.findOne(
        {
            $or:[{ userName }, { email }]
        }
    )
    if(existedUser){
        throw new ApiError(409,"User already exists");
    }
    //check for images,avatar
   const avatarLocalPath= req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    //upload them to cloudinary,avatars
   const avatar= await uploadOnCloudinary(avatarLocalPath);
   const coverImage= await uploadOnCloudinary(coverImageLocalPath);
   if(!avatar)
   {console.log("FILES:",req.files)
     throw new ApiError(400,"Avatar file is required")}
    //create user object, create entry in db
   const user=await  User.create({
        fullName,
        avatar : avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        userName:userName.toLowerCase()

    })

  
   
    //remove password and refresh token field from response
      const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //check for user creation
     if(!createdUser)
        throw new ApiError(500,"Something went wrong while registering the user")
    //return res
    return res.status(201).json(
     new ApiResponse(200,createdUser,"User registered successfully")
    )
 }) 
const generateAcccessAndRefreshTokens=async(userId)=>{
       try {
        const user= await User.findById(userId)
        const accessToken=user.generateAcccessToken()
        const refreshToken=user.generateRefreshToken()
        user.refreshToken=refreshToken;
        user.save({validateBeforeSave:false})
        return{accessToken,refreshToken};
       } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
       }
}
 const loginUser= asyncHandler(async(req,res)=>{
    //req.body->data
    const {email,userName,password}=req.body;
    //username and email
    if(!userName||!email){
        throw new ApiError(400,"username or email is required")
    }
    //find the user
    const user=User.findOne({
        $or:[{userName},{email}]
    })
    if(!user)
        throw new ApiError(404,"User does not exist")
    //check password
    const isPasswordValid=await user.isPasswordCorrect(password);
    if(!isPasswordValid)
        throw new ApiError(401,"Invalid user credentials");
    
    //access token and refresh token
    const {accessToken,refreshToken}=generateAcccessAndRefreshTokens(user._id);
    
    //send cookies
    const loggedInUser= await User.findById(user._id).select("-password -refreshToken");
    const options={
        httpOnly:true,
        secure: true
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshTOken",refreshToken,options)
    .json(
        new ApiResponse(200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged in Successfully"

        )
    )

    
 })

 const logoutUser= asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(req.user._id,{
    $set:{
        refreshToken:undefined
    }
    
   },
{
    new:true
})

 const options={
        httpOnly:true,
        secure: true
    }

    return res.status(200)
    .clearcookie(accessToken)
    .clearcookie(refreshToken)
    .json(new ApiResponse(200, {},"User logged out successfully"))
 })

     const refreshAccessToken=asyncHandler(async  (req,res)=> {
      try {
         const incomingRefreshToken= req.cookies.refreshToken||req.body.refreshToken;
       if(!incomingRefreshToken)
        throw new ApiError(401,"Unauthorized request")
     const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
     const user=await User.findById(decodedToken?._id)
     if(!user)
        throw new ApiError(401,"Invalid refresh token")
    if(incomingRefreshToken!==user?.refreshToken)
        throw new ApiError(401,"Refresh token expired or used")
    const options={
        httpOnly:true,
        secure:true
    }
    const {accessToken,newRefreshToken}=generateAcccessAndRefreshTokens(user._id)
    return res.status(201)
    .cookie("accessToken",accessToken,options)
    .cookie("newRefreshToken",newRefreshToken,options)
    .json( new ApiResponse(200,{
        acessToken,refreshToken:newRefreshToken
    },"Access token is refreshed"))
    } catch (error) {
    throw new ApiError(401,error?.message)
}
     })


const changeCurrentPassword=(req,res)=>{
    const{oldPassword,newPassword}=req.body;
     
    const user=await User.findById(req.user._id);
    const isPassswordCorrect=user.isPasswordCorrect(oldPassword)
    if(!isPassswordCorrect)
        throw new ApiError(401,"Invalid password")
    user.password=newPassword;
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,"Password changed successfully"))
}
const getCurrentUser=asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
})

const UpdateAccountDetails=asyncHandler(async (req,res) => {
    const {fullName,email}=req.body();
    if(!fullName || !email)
        throw new ApiError(400,"All fields are required")
    await   User.findByIdAndUpdate(req.user?.id,{
        $set:{
            fullName,
            email:email
        }
    },{new:true}).select("-password")
    
   return res
   .status(200)
   .json(new ApiResponse(200,user,"Account details updated successfully"))

})
const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path
    if(!avatarLocalPath)
        throw new ApiError(400,"Avatar file is missing")
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url)
        throw new ApiError(400,"Error while uploading avatar on Cloudinary")
    await User.findByIdAndUpdate(req.user?._Id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")
    return res.status(200)
    .json(new ApiResponse(200,user,"Avatar changed successfully"))


})
const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path
    if(!coverImageLocalPath)
        throw new ApiError(400,"coverImage file is missing")
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url)
        throw new ApiError(400,"Error while uploading avatar on Cloudinary")
    await User.findByIdAndUpdate(req.user?._Id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"coverImage updated successfully"))


})
const getUserChannelProfile= asyncHandler(async(req,res)=>{
    const {userName}=req.params;
    if(!userName?.trim())
        throw new ApiError(400,"username is missing")
    const channel=await User.aggregate([
        {
            $match:{
                userName:userName?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"Subscription",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            
            }
        },
        {
            $lookup:{
                from:"Subscription",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers",
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                userName:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }

    ])
    if(!channel?.length){
        throw new ApiError(404,"channel does not exists")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully  ")
    )

})
const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await  User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"Users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                               { $project:{
                                    fullName:1,
                                    userName:1,
                                    avatar:1

                                }}
                            ]
                        }
                    },
                    {
                     $addFields:{
                        owner:{
                            $first:"$owner"
                        }
                     }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"watchHistory fetched successfully")
    )
})



 export {registerUser,loginUser,logoutUser,refreshAccessToken,
    changeCurrentPassword,getCurrentUser,UpdateAccountDetails,updateUserAvatar,updateUserCoverImage,
getUserChannelProfile,getWatchHistory}