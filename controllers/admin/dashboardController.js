export const loadDashboard =  async(req,res)=>{
    try{
        console.log('njb')
         res.render("admin/dashboard");
    }catch(error){
        console.error("error");
        
        console.log("dashboard not found");
        res.status(500).send("server error");
        
        
    }
}



//  console.log(error);
        
//         console.log("Home page not found");
//         res.status(500).send("server error");