import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

  const allowedTypes = /jpg|jpeg|png|webp/;

  const ext = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (ext) {

    cb(null, true);

  } else {

    cb(new Error("Only images are allowed"));
  }
};

const upload = multer({

  fileFilter: (req, file, cb) => {

  const allowedTypes = [

    "image/jpeg",

    "image/jpg",

    "image/png",

    "image/webp"
  ];


  if (allowedTypes.includes(file.mimetype)) {

    cb(null, true);

  } else {

    cb(

      new Error(

        "Only JPG, PNG and WEBP images are allowed"
      )
    );
  }
},

limits: {

  fileSize: 5 * 1024 * 1024
},
  storage,

  fileFilter
});

export default upload;