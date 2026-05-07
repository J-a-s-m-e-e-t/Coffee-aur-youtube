import mongoose, { Schema, SchemaType } from "mongoose";

const sucbscriptionSchema=new Schema({
subscriber:{
    type:Schema.Types.ObjectId,  //the one who is subscribing
    ref:"User"
},
channel:{
    type:Schema.Types.ObjectId,   // the one whom the subscriber is subscribing
    ref:"User"
}
},{timestamps:true})

export const Subscription= mongoose.model("Subscription",sucbscriptionSchema)