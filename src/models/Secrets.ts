import { model, Schema } from "mongoose";

interface ISecret {
  text: string;
}

const SecretSchema = new Schema<ISecret>({
  text: { type: String, required: true }
});

const Secret = model<ISecret>("Secret", SecretSchema);

export { Secret, SecretSchema, ISecret };
