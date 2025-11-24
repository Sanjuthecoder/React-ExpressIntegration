
const express = require("express")
const app = express();
let detailsArr = [];
app.use(express.json());
app.use(express.urlencoded());

app.post("/path",(req,res)=>{
    let data = req.body;
    detailsArr.push(data);
    res.send({ type: "success", msg: "Successfully saved" })
})


//to send back the data to frontend
app.get("/details",(req,res)=>{
    console.log("getting details");
    
    res.send(detailsArr);
})

app.get("/",(req,res)=>{
    res.send("Hello");
})





app.listen("8000",function(){
    console.log("Server is running at 8000");
    
})