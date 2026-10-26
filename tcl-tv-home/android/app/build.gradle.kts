plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.tvhome.launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tvhome.launcher"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
    }

    // A fixed, non-secret debug key committed with the project, so every build
    // (local or from GitHub Actions) installs as an update over the last one.
    signingConfigs {
        getByName("debug") {
            storeFile = file("tvhome-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    // The home screen itself is the shared web folder (also previewable in a browser).
    sourceSets {
        getByName("main") {
            assets.srcDirs("../../web")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
