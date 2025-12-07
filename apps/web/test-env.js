
import { env } from '@xenova/transformers';

console.log("env:", env);
console.log("env.backends:", env.backends);
if (env.backends && env.backends.onnx) {
    console.log("env.backends.onnx:", env.backends.onnx);
    console.log("Setting logLevel to 'error'...");
    // @ts-ignore
    env.backends.onnx.logLevel = 'error';
    console.log("env.backends.onnx.logLevel:", env.backends.onnx.logLevel);
} else {
    console.log("env.backends.onnx is undefined");
}
