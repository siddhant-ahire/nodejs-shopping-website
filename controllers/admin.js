const { validationResult } = require('express-validator')
const Product = require('../models/product');
const fielHelper = require('../util/file');

exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    isAuthenticated: req.session.isLoggedIn,
    isError: false,
    errorMessage: false,
    validationError: []

  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;

  if (!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      isAuthenticated: req.session.isLoggedIn,
      isError: true,
      product: {
        title: title,
        price: price,
        description: description
      },
      errorMessage: "image file is not valid",
      validationError: []

    });
  }
  console.log(image);
  const error = validationResult(req);
  const errorMessage = error.array();
  if (!error.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      isAuthenticated: req.session.isLoggedIn,
      isError: true,
      product: {
        title: title,
        price: price,
        description: description
      },
      errorMessage: errorMessage[0].msg,
      validationError: []

    });
  }

  const product = new Product({
    title: title,
    price: price,
    description: description,
    imageUrl: image.path,
    userId: req.user
  });
  product
    .save()
    .then(result => {
      res.redirect('/admin/products');
    })
    .catch(err => { 
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);


    });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/');
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return res.redirect('/');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product: product,
        isAuthenticated: req.session.isLoggedIn,
        isError: false,
        errorMessage: false,
        validationError: []
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;
  const error = validationResult(req);
  const errorMessage = error.array();

  if (!error.isEmpty()) {
    return res.render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/edit-product',
      editing: true,
      isAuthenticated: req.session.isLoggedIn,
      isError: false,
      errorMessage: errorMessage[0].msg,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        errorMessage: errorMessage[0].msg,
        _id: prodId
      },
      validationError: errorMessage
    });
  }
  Product.findById(prodId)
    .then(product => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect('/shop');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        fielHelper.deleteFile(product.imageUrl);
        product.imageUrl = image.path;
      }
      return product.save().then(result => {
        res.redirect('/admin/products');
      })
        .catch(err => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);

        });
    })
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    .then(products => {
      console.log(products);
      res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products',
        isAuthenticated: req.session.isLoggedIn
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return next(new Error('Product Not found'))
      }
      fielHelper.deleteFile(product.imageUrl);
      return Product.deleteOne({ userId: req.user._id, _id: prodId })
    })
    .then(() => {
      res.json({ message: "product deleted successfully" })
    })
    .catch(err => {
      res.json({ message: "product not deleted" })
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

    });
};
