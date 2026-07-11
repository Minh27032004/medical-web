# Build 2 tầng: tầng 1 build jar bằng Maven, tầng 2 chỉ chứa JRE + jar (image nhỏ, an toàn)
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Tải dependencies trước để cache layer — đổi code không phải tải lại
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Cloud Run cấp PORT qua env; application.yml đã đọc ${PORT:8080}
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
