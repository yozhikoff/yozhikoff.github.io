// 🚀 ONNX Tensor Extensions - Multi-dimensional access for ONNX Runtime tensors
// This module monkey-patches ort.Tensor with convenience methods for NCA operations

export function initializeONNXExtensions() {
    // Calculate strides for tensor shape [batch, channels, height, width]
    ort.Tensor.prototype.calculateStrides = function() {
        if (!this._strides) {
            const shape = this.dims;
            this._strides = new Array(shape.length);
            this._strides[shape.length - 1] = 1;
            for (let i = shape.length - 2; i >= 0; i--) {
                this._strides[i] = this._strides[i + 1] * shape[i + 1];
            }
        }
        return this._strides;
    };
    
    // Get value at [batch, channel, y, x]
    ort.Tensor.prototype.get = function(b, c, y, x) {
        const strides = this.calculateStrides();
        const index = b * strides[0] + c * strides[1] + y * strides[2] + x * strides[3];
        return this.data[index];
    };
    
    // Set value at [batch, channel, y, x]
    ort.Tensor.prototype.set = function(b, c, y, x, value) {
        const strides = this.calculateStrides();
        const index = b * strides[0] + c * strides[1] + y * strides[2] + x * strides[3];
        this.data[index] = value;
    };
    
    // Set entire channel to a value
    ort.Tensor.prototype.setChannel = function(b, c, value) {
        const [batch, channels, height, width] = this.dims;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.set(b, c, y, x, value);
            }
        }
    };
    
    // Set vertical column in a channel
    ort.Tensor.prototype.setColumn = function(b, c, x, value) {
        const [batch, channels, height, width] = this.dims;
        for (let y = 0; y < height; y++) {
            this.set(b, c, y, x, value);
        }
    };
    
    // Fill entire tensor with value
    ort.Tensor.prototype.fill = function(value) {
        this.data.fill(value);
    };
    
    // Copy from another tensor
    ort.Tensor.prototype.copyFrom = function(otherTensor) {
        if (this.data.length !== otherTensor.data.length) {
            throw new Error('Tensor size mismatch');
        }
        this.data.set(otherTensor.data);
    };
    
    // Resize tensor by creating new one and copying data
    ort.Tensor.prototype.resize = function(newWidth) {
        const [batchSize, channels, height, oldWidth] = this.dims;
        const newData = new Float32Array(batchSize * channels * height * newWidth);
        const newTensor = new ort.Tensor(this.type, newData, [batchSize, channels, height, newWidth]);
        
        // Copy existing data (batch is always 0 for our use case)
        const batch = 0;
        const copyWidth = Math.min(oldWidth, newWidth);
        
        for (let c = 0; c < channels; c++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < copyWidth; x++) {
                    const value = this.get(batch, c, y, x);
                    newTensor.set(batch, c, y, x, value);
                }
            }
        }
        
        return newTensor;
    };
    
    // Trim tensor from left side
    ort.Tensor.prototype.trimLeft = function(trimAmount) {
        const [batchSize, channels, height, oldWidth] = this.dims;
        const newWidth = oldWidth - trimAmount;
        const newData = new Float32Array(batchSize * channels * height * newWidth);
        const newTensor = new ort.Tensor(this.type, newData, [batchSize, channels, height, newWidth]);
        
        // Copy remaining data (batch is always 0 for our use case)
        const batch = 0;
        
        for (let c = 0; c < channels; c++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < newWidth; x++) {
                    const value = this.get(batch, c, y, x + trimAmount);
                    newTensor.set(batch, c, y, x, value);
                }
            }
        }
        
        return newTensor;
    };
    
    // Get tensor info string
    ort.Tensor.prototype.getInfo = function() {
        return `[${this.dims.join(', ')}]`;
    };
}