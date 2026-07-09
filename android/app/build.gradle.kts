plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.reak.khmerkeyboard"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.reak.khmerkeyboard"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    // One stable signing key (created and committed once by CI) so every
    // update installs over the previous one without uninstalling.
    signingConfigs {
        create("release") {
            val ks = file("genz.keystore")
            if (ks.exists()) {
                storeFile = ks
                storePassword = "genzkeystore"
                keyAlias = "genz"
                keyPassword = "genzkeystore"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
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
