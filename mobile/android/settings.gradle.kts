pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("$rootDir/../node_modules/react-native/android")
        }
        maven {
            url = uri("$rootDir/../node_modules/jsc-android/dist")
        }
        maven {
            url = uri("https://jitpack.io")
        }
    }
}

rootProject.name = "SubscriptionManager"

apply(from = file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle"))
val applyNativeModulesSettingsGradle: groovy.lang.Closure<Any> by extra
applyNativeModulesSettingsGradle(settings)

include(":app")
includeBuild("../node_modules/@react-native/gradle-plugin")
 