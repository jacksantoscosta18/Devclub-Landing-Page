const stages = document.querySelectorAll(".stage")
const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add("active-visible")
        }
    })
}, { threshold: .4 })
stages.forEach(s => io.observe(s))

const trilha = document.getElementById("formacoes")
const progressPath = document.getElementById("progressPath")
const pathLength = progressPath.getTotalLength()
progressPath.style.strokeDasharray = pathLength
progressPath.style.strokeDashoffset = pathLength

function updateTrackProgress() {
    const rect = trilha.getBoundingClientRect()
    const vh = window.innerHeight
    const total = rect.height - vh * 0.3
    const passed = Math.min(Math.max(-rect.top + vh * 0.5, 0), total)
    const ratio = total > 0 ? passed / total : 0
    progressPath.style.strokeDashoffset = pathLength * (1 - ratio)
}
window.addEventListener("scroll", updateTrackProgress, { passive: true })
window.addEventListener("resize", updateTrackProgress)
updateTrackProgress()