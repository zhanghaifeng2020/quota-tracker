FROM node:22-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --omit=dev

# 复制源码
COPY . .

# 暴露端口
EXPOSE 3333

# 启动服务
CMD ["npm", "start"]
