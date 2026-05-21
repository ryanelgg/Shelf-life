import Foundation
import Capacitor
import AVFoundation
import UIKit

// MARK: - Plugin registration

@objc(CapacitorBarcodeScanner)
public class CapacitorBarcodeScanner: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorBarcodeScanner"
    public let jsName = "CapacitorBarcodeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let vc = BarcodeScannerViewController()
            vc.modalPresentationStyle = .fullScreen
            vc.onResult = { barcode in
                call.resolve(["displayValue": barcode])
            }
            vc.onCancel = {
                call.reject("USER_CANCELLED", "USER_CANCELLED", nil)
            }
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }
}

// MARK: - Native camera scanner view controller

class BarcodeScannerViewController: UIViewController,
                                     AVCaptureMetadataOutputObjectsDelegate {

    var onResult: ((String) -> Void)?
    var onCancel: (() -> Void)?

    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var hasFired = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
        setupUI()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if captureSession?.isRunning == false {
            DispatchQueue.global(qos: .userInitiated).async {
                self.captureSession?.startRunning()
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if captureSession?.isRunning == true {
            captureSession?.stopRunning()
        }
    }

    private func setupCamera() {
        let session = AVCaptureSession()
        captureSession = session

        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else { return }
        guard let videoInput = try? AVCaptureDeviceInput(device: videoCaptureDevice) else { return }
        guard session.canAddInput(videoInput) else { return }
        session.addInput(videoInput)

        let metadataOutput = AVCaptureMetadataOutput()
        guard session.canAddOutput(metadataOutput) else { return }
        session.addOutput(metadataOutput)

        metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
        metadataOutput.metadataObjectTypes = [
            .ean8, .ean13, .upce, .code128, .code39,
            .qr, .pdf417, .itf14, .code93
        ]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.layer.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.insertSublayer(preview, at: 0)
        previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
        }
    }

    private func setupUI() {
        // Dimmed overlay with a clear scanning window
        let overlayView = ScannerOverlayView()
        overlayView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(overlayView)
        NSLayoutConstraint.activate([
            overlayView.topAnchor.constraint(equalTo: view.topAnchor),
            overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        // Cancel button
        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .medium)
        cancelButton.backgroundColor = UIColor(white: 0, alpha: 0.4)
        cancelButton.layer.cornerRadius = 20
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(cancelButton)
        NSLayoutConstraint.activate([
            cancelButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cancelButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -32),
            cancelButton.widthAnchor.constraint(equalToConstant: 120),
            cancelButton.heightAnchor.constraint(equalToConstant: 44),
        ])

        // Hint label
        let hintLabel = UILabel()
        hintLabel.text = "Point camera at a barcode"
        hintLabel.textColor = UIColor(white: 1, alpha: 0.85)
        hintLabel.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        hintLabel.textAlignment = .center
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hintLabel)
        NSLayoutConstraint.activate([
            hintLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hintLabel.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -20),
        ])
    }

    @objc private func cancelTapped() {
        dismiss(animated: true) {
            self.onCancel?()
        }
    }

    // MARK: - AVCaptureMetadataOutputObjectsDelegate

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard !hasFired,
              let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = obj.stringValue else { return }

        hasFired = true
        captureSession?.stopRunning()

        // Haptic feedback
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()

        dismiss(animated: true) {
            self.onResult?(value)
        }
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
}

// MARK: - Overlay view with cutout

class ScannerOverlayView: UIView {
    private let cutoutSize = CGSize(width: 260, height: 160)

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        // Dark background
        UIColor(white: 0, alpha: 0.55).setFill()
        ctx.fill(rect)

        // Clear cutout
        let cutout = CGRect(
            x: (rect.width - cutoutSize.width) / 2,
            y: (rect.height - cutoutSize.height) / 2 - 40,
            width: cutoutSize.width,
            height: cutoutSize.height
        )
        ctx.setBlendMode(.clear)
        UIBezierPath(roundedRect: cutout, cornerRadius: 12).fill()

        // Corner brackets
        ctx.setBlendMode(.normal)
        let accent = UIColor(red: 0.29, green: 0.49, blue: 0.35, alpha: 1) // matches --accent
        accent.setStroke()
        ctx.setLineWidth(3)
        ctx.setLineCap(.round)
        let r: CGFloat = 12
        let len: CGFloat = 24

        // Top-left
        ctx.move(to: CGPoint(x: cutout.minX + r, y: cutout.minY))
        ctx.addLine(to: CGPoint(x: cutout.minX + r + len, y: cutout.minY))
        ctx.move(to: CGPoint(x: cutout.minX, y: cutout.minY + r))
        ctx.addLine(to: CGPoint(x: cutout.minX, y: cutout.minY + r + len))
        // Top-right
        ctx.move(to: CGPoint(x: cutout.maxX - r - len, y: cutout.minY))
        ctx.addLine(to: CGPoint(x: cutout.maxX - r, y: cutout.minY))
        ctx.move(to: CGPoint(x: cutout.maxX, y: cutout.minY + r))
        ctx.addLine(to: CGPoint(x: cutout.maxX, y: cutout.minY + r + len))
        // Bottom-left
        ctx.move(to: CGPoint(x: cutout.minX + r, y: cutout.maxY))
        ctx.addLine(to: CGPoint(x: cutout.minX + r + len, y: cutout.maxY))
        ctx.move(to: CGPoint(x: cutout.minX, y: cutout.maxY - r))
        ctx.addLine(to: CGPoint(x: cutout.minX, y: cutout.maxY - r - len))
        // Bottom-right
        ctx.move(to: CGPoint(x: cutout.maxX - r - len, y: cutout.maxY))
        ctx.addLine(to: CGPoint(x: cutout.maxX - r, y: cutout.maxY))
        ctx.move(to: CGPoint(x: cutout.maxX, y: cutout.maxY - r))
        ctx.addLine(to: CGPoint(x: cutout.maxX, y: cutout.maxY - r - len))

        ctx.strokePath()
    }
}
