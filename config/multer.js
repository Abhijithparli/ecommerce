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

  storage,

  fileFilter
});

export default upload;