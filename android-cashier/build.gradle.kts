plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}

val externalBuildDir = file("C:/tmp/mula-cashier-build")
rootProject.layout.buildDirectory.set(File(externalBuildDir, "root"))

subprojects {
    layout.buildDirectory.set(File(externalBuildDir, name))
}
