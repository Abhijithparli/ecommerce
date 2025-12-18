

export const loadHomepage = async (req,res)=>{
    try{
        res.render("home");
    }catch(error){
        console.log(error);
        res.status(500).send("server error");
        
    }
}








// const loadHomepage = async(req,res)=>{
//     try{
//         // console.log("yess")
//         return res.render("home");
//     }catch (error){
//         console.log(error);
        
//         console.log("Home page not found");
//         res.status(500).send("server error");
//     }
// }


// // const loadHomepage = (req, res) => {
// //   res.render("home"); // home.ejs
// // };

// module.exports = {
//   loadHomepage,
// };
