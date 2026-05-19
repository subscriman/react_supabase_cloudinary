const cloudinary = {
  uploader: {
    async destroy(_publicId: string, _options?: Record<string, unknown>) {
      return { result: 'not found' };
    },
  },
};

export default cloudinary;
