# syntax=docker/dockerfile:1

# ---------- build ----------
FROM eclipse-temurin:26-jdk AS build
WORKDIR /build

# Copy the wrapper and POM first. As long as dependencies do not change this
# layer is reused, so editing source does not re-download the world.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src/ src/
# Tests are skipped here: the context test needs Kafka, which is not available
# during an image build. Run them on your machine before deploying.
RUN ./mvnw -B clean package -DskipTests

# ---------- run ----------
FROM eclipse-temurin:26-jre-alpine
WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring

# Only the fat jar is carried over — the JDK and the Maven cache stay behind.
# --chown on the COPY rather than a following RUN chown: a separate chown layer
# would write a second full copy of the 100 MB jar into the image.
COPY --from=build --chown=spring:spring /build/target/*.jar app.jar
USER spring

EXPOSE 8080

# t3.small has 2 GB total and Kafka takes roughly half, so the JVM is capped
# rather than left to size itself against the whole machine. SerialGC keeps
# the footprint small; this workload polls one API every five minutes.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=55 -XX:+UseSerialGC"

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

# exec form via sh so JAVA_OPTS expands, but the JVM still becomes PID 1 and
# receives SIGTERM directly for a clean shutdown.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
