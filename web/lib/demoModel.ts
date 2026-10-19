/** Robot mẫu nhiều linh kiện, dựng từ khối cơ bản — model mặc định của /play, không cần tải file. */
export type DemoPart = {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  /** box: rộng × cao × sâu; cylinder: [bán kính, cao, bán kính]; sphere: [bán kính, _, _] */
  size: [number, number, number];
  position: [number, number, number];
  color: string;
};

export const DEMO_NAME = "Robot mẫu";

export const DEMO_PARTS: DemoPart[] = [
  { id: "body", name: "Thân", shape: "box", size: [1.4, 1.6, 0.8], position: [0, 0, 0], color: "#9fb3c8" },
  { id: "head", name: "Đầu", shape: "box", size: [1.0, 0.8, 0.8], position: [0, 1.3, 0], color: "#c9d6e3" },
  { id: "eye-l", name: "Mắt trái", shape: "sphere", size: [0.12, 0.12, 0.12], position: [-0.22, 1.38, 0.42], color: "#3df5c4" },
  { id: "eye-r", name: "Mắt phải", shape: "sphere", size: [0.12, 0.12, 0.12], position: [0.22, 1.38, 0.42], color: "#3df5c4" },
  { id: "antenna", name: "Ăng-ten", shape: "cylinder", size: [0.05, 0.5, 0.05], position: [0, 1.95, 0], color: "#ffb547" },
  { id: "arm-l", name: "Tay trái", shape: "cylinder", size: [0.18, 1.3, 0.18], position: [-0.95, 0.05, 0], color: "#7d8fa3" },
  { id: "arm-r", name: "Tay phải", shape: "cylinder", size: [0.18, 1.3, 0.18], position: [0.95, 0.05, 0], color: "#7d8fa3" },
  { id: "leg-l", name: "Chân trái", shape: "box", size: [0.45, 1.1, 0.5], position: [-0.35, -1.4, 0], color: "#6b7c8f" },
  { id: "leg-r", name: "Chân phải", shape: "box", size: [0.45, 1.1, 0.5], position: [0.35, -1.4, 0], color: "#6b7c8f" },
];
