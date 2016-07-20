import { Component, OnInit, Injectable, ViewChild, ElementRef, AfterViewChecked, AfterViewInit } from '@angular/core';
import { UploaderComponent } from './uploader.component';
import { Reach } from '../Classes/Reach';
import { Cross } from '../Classes/Cross';
import { FileManager } from '../Classes/FileManager';
import { ReachCollection } from '../Classes/ReachCollection';
import * as _ from 'lodash';

@Component({
    selector: 'ide-app',
    templateUrl: '/Components/ide.component.html',
    styles:[
    `
    a {
        color: #00B7FF;
    }

    #canvas{
        border:1px solid #eee;
        position: relative; top: -30px;
        z-index: 0;
        background-color: white;
    }
    #controls{
        position:relative;
        left:5px;
        z-index: 1;
    }
    .controlButton {
        width: 24px;
        height: 24px;
    }
    #viewport{

    }

    .noselect {
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none;   /* Chrome/Safari/Opera */
        -khtml-user-select: none;    /* Konqueror */
        -moz-user-select: none;      /* Firefox */
        -ms-user-select: none;       /* Internet Explorer/Edge */
        user-select: none;           /* Non-prefixed version, currently
                                        not supported by any browser */
    }
    td {
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .input-xs {
        height: 22px;
        padding: 5px 5px;
        font-size: 12px;
        line-height: 1.5;
        border-radius: 3px;
    }
    .click : hover{
        cursor: pointer;
    }

    .btn:focus, .btn:active{
        outline: none !important;
    }

    `],
    directives: [UploaderComponent]
})

export class IdeComponent implements OnInit, AfterViewChecked, AfterViewInit
{
    @ViewChild(UploaderComponent) Uploader: UploaderComponent;
    @ViewChild('ZoomAllButton') ZoomAllButton: ElementRef;
    @ViewChild('ZoomInButton') ZoomInButton: ElementRef;
    @ViewChild('ZoomOutButton') ZoomOutButton: ElementRef;
    @ViewChild('RotateButton') RotateButton: ElementRef;
    @ViewChild('MoveButton') MoveButton: ElementRef;
    @ViewChild('LabelButton') LabelButton: ElementRef;
    @ViewChild('MeshButton') MeshButton: ElementRef;
    @ViewChild('LinesButton') LinesButton: ElementRef;
    @ViewChild('AxesHelperButton') AxesHelperButton: ElementRef;
    IdeApp: IdeComponent;
    HECRASInputs: Array<String>;
    DisplayView: any;
    ratio: number;
    BoundingSphereRadius: number;
    BoundingSphereCenter: THREE.Vector3;
    selectedReach: Reach;
    crossScaleX: number = 1;
    crossScaleY: number = 1;
    crossScaleZ: number = 1;
    Reaches: Array<Reach>;
    divCanvas: HTMLElement;
    fileManager: FileManager;
    camera: THREE.OrthographicCamera;
    cameraHUD: THREE.Camera;
    scene: THREE.Scene;
    labelScene: THREE.Scene;
    hudScene: THREE.Scene;
    AxesHUD: THREE.Object3D;
    Plane: THREE.Plane;
    PointLight: THREE.PointLight;
    AmbientLight: THREE.AmbientLight;
    reachCollection: ReachCollection;
    gl: any;
    renderer: any;
    controls: THREE.OrthographicTrackballControls;
    prevCtrls: THREE.OrthographicTrackballControls;
    prevCam: THREE.OrthographicCamera;

    constructor()
    {
        this.IdeApp = this;
        ideApp = this;
        this.DisplayView = { view: 'line' };
    }


    CloseModal()
    {
        this.Uploader.Clear();
    }

    PushInput(input: string)
    {
        this.HECRASInputs.push(input);
    }

    mouseup(e: MouseEvent)
    {
        if(e.button == 2)
        {
            var scaleVector3 = new THREE.Vector3(ideApp.crossScaleX, ideApp.crossScaleY, ideApp.crossScaleZ);
            var dir = _.clone<THREE.Vector3>(ideApp.controls.target).sub(_.clone<THREE.Vector3>(ideApp.camera.position));
            var ray = new THREE.Ray(ideApp.camera.position, dir);
            var point = ray.intersectPlane(ideApp.Plane);

            if(point)
            {
                ideApp.controls.target.set(point.x, point.y, point.z);
                ideApp.camera.lookAt(point);
            }
        }
    }

    Init()
    {
        this.reachCollection.Clear();
        this.ClearScene(this.scene);
        this.ClearScene(this.labelScene);
        
        this.selectedReach = null;
        this.Reaches = [];
        
        if(this.HECRASInputs.length > 0)
        {
            this.initReachCollection(this.HECRASInputs, () =>
            {
                this.CalculateBoundingSphere();
                this.DisplayAllReaches();
                this.SetCamera();  
            });
        }
        this.Animate();
    }

    ngOnInit()
    {
        var w = window.innerWidth;
        var h = window.innerHeight;
        var ratio = h/w;
        this.ratio = ratio;
        this.divCanvas = document.getElementById("canvas");
        var parent = document.getElementById("viewport");
        this.divCanvas.style.width = (parent.clientWidth - 350) + "px";
        this.divCanvas.style.height = (parent.clientWidth - 350)* ratio + "px";
        parent.style.cssFloat="left";
        parent.style.width = this.divCanvas.style.width;
        parent.style.height = this.divCanvas.style.height;
        this.divCanvas.addEventListener( 'mouseup', this.mouseup, false );
        this.CreateRenderer(this.divCanvas);
        this.divCanvas.appendChild(this.renderer.domElement);
        this.reachCollection = new ReachCollection();
        this.CreateScenes();
        this.CreatePlane();
        this.CreateLight();
        this.CreateCamera();
        this.CreateCameraHUD();
        this.CreateHUD(this.hudScene);
        this.SetLight();
        this.HECRASInputs = [];
    }

    ngAfterViewChecked()
    {
        
    }

    ngAfterViewInit()
    {
        this.SetDefualtControls();
    }

    CreateHUD(scene: THREE.Scene)
    {
        this.AxesHUD = this.buildAxes(0.1);
        this.AxesHUD.applyMatrix(new THREE.Matrix4().makeTranslation(-0.8, -0.8, 0));
        scene.add(this.AxesHUD);
    }

    buildAxes(length) 
    {
        
        var axes = new THREE.Object3D();
        axes.add(this.buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( length, 0, 0 ), 0xFF0000, false )); // +X
        axes.add(this.buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, length, 0 ), 0x00FF00, false )); // +Y
        axes.add(this.buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, length ), 0x0000FF, false )); // +Z
        return axes;
    }

    buildAxis( src, dst, colorHex, dashed ) 
    {
        var geom = new THREE.Geometry(),
            mat; 

        if(dashed) {
            mat = new THREE.LineDashedMaterial({ linewidth: 3, color: colorHex, dashSize: 3, gapSize: 3 });
        } else {
            mat = new THREE.LineBasicMaterial({ linewidth: 3, color: colorHex });
        }

        geom.vertices.push( src.clone() );
        geom.vertices.push( dst.clone() );
        geom.computeLineDistances(); // This one is SUPER important, otherwise dashed lines will appear as simple plain lines

        var axis = new THREE.Line( geom, mat, THREE.LinePieces );

        return axis;

    }

    SetDefualtControls()
    {
        this.CreateControls(true, false, true, false);
        this.LinesButtonOnClick(this.LinesButton.nativeElement);
        this.MoveButtonOnClick(this.MoveButton.nativeElement);
        this.RotateButtonOnClick(this.RotateButton.nativeElement);
    }

    ToggleButton(element: HTMLElement) : boolean
    {
        var ClassList = element.classList;
        var i = 0;
        while (i < ClassList.length && ClassList[i] != "active")i++;
        
        if(i>=ClassList.length)
        {
            ClassList.add("active");
            $(element).blur();
            return true;
        }
        else
        {
            ClassList.remove("active");
            $(element).blur();
            return false;
        }
    }

    ToggleButtonGroup(element: HTMLElement, dependencies: Array<ElementRef>)
    {
        var ClassList = element.classList;
        ClassList.add("active");
        for (var i = 0; i < dependencies.length; i++)
            dependencies[i].nativeElement.classList.remove("active");;
        $(element).blur();
    }

    AxesHelperButtonOnClick(element: HTMLElement)
    {
         this.AxesHelperButton.nativeElement.pressed = this.ToggleButton(this.AxesHelperButton.nativeElement);
    }

    LinesButtonOnClick(element: HTMLElement)
    {
        ideApp.ToggleButtonGroup(element, [ideApp.MeshButton]);
        ideApp.DisplayView.view = 'line';
        ideApp.ChangeView();
    }

    MeshButtonOnClick(element: HTMLElement)
    {
        ideApp.ToggleButtonGroup(element, [ideApp.LinesButton]);
        ideApp.DisplayView.view = 'mesh';
        ideApp.ChangeView();
    }

    RotateButtonOnClick(element: HTMLElement)
    {
        var pressed: boolean = ideApp.ToggleButton(element);

        if(pressed)
            ideApp.controls.noRotate = false;
        else
            ideApp.controls.noRotate = true;
        ideApp.controls.update();
    }

    ZoomInButtonOnClick(element: HTMLElement)
    {
        ideApp.camera.zoom /=0.9;
        ideApp.camera.updateProjectionMatrix();
        $(element).blur();
    }

    ZoomOutButtonOnClick(element: HTMLElement)
    {
        ideApp.camera.zoom *=0.9;
        ideApp.camera.updateProjectionMatrix();
        $(element).blur();
    }

    LabelButtonOnClick(element: HTMLElement)
    {
        ideApp.LabelButton.nativeElement.pressed = ideApp.ToggleButton(element);
    }

    MoveButtonOnClick(element: HTMLElement)
    {
        var pressed: boolean = ideApp.ToggleButton(element);

        if(pressed)
            ideApp.controls.noPan = false;
        else
            this.controls.noPan = true;
        ideApp.controls.update();
    }

    CalculateBoundingSphere()
    {
        var vertices = new Array<THREE.Vector3>();
        for (var r = 0; r < this.reachCollection.Reaches.length; r++) 
        {
            var reach = this.reachCollection.Reaches[r];
            for (var c = 0; c < reach.Crosses.length; c++)
            {
                var cross = reach.Crosses[c];
                for (var v = 0; v < cross.vertices.length; v++)
                {
                    vertices.push(cross.vertices[v]);  
                }   
            }
        }
        var tmpG = new THREE.Geometry();
        tmpG.vertices = vertices;
        tmpG.computeBoundingSphere(); 
        this.BoundingSphereRadius = tmpG.boundingSphere.radius;
        this.BoundingSphereCenter = this.GetCenter(vertices);
    }

    GetCenter(vertices: Array<THREE.Vector3>) : THREE.Vector3
    {
        var min = Number.MAX_VALUE, max = 0;
        var vecMin:THREE.Vector3, vecMax: THREE.Vector3;

        for (var i = 0; i < vertices.length; i++)
        {
            var vertex = vertices[i];
            var len = vertex.length();
            if(len < min)
            {
                min = len;
                vecMin = _.cloneDeep<THREE.Vector3>(vertex);
            }
            else if(len > max)
            {
                max = len;
                vecMax = _.cloneDeep<THREE.Vector3>(vertex);;
            }
        }
        var sub = _.cloneDeep<THREE.Vector3>(vecMax);
        sub.sub(vecMin);
        sub.multiplyScalar(0.5);
        return vecMax.sub(sub);
    }

    ZoomAllButtonOnClick(element: HTMLElement)
    {
        var width = this.BoundingSphereRadius;
        var height = width; 
        this.camera.left = -width;
        this.camera.right = width;
        this.camera.top = height;
        this.camera.bottom = -height;
        
        this.camera.lookAt(new THREE.Vector3(this.BoundingSphereCenter.x, this.BoundingSphereCenter.y, this.BoundingSphereCenter.z));
        this.controls.target.set(this.BoundingSphereCenter.x, this.BoundingSphereCenter.y, this.BoundingSphereCenter.z);
        this.controls.target0.set(this.BoundingSphereCenter.x, this.BoundingSphereCenter.y, this.BoundingSphereCenter.z);
        this.camera.zoom = 1;
        
        this.camera.updateProjectionMatrix();
    }

    ChangeView()
    {
        if(ideApp.selectedReach)
        {
            ideApp.DisplayReach(ideApp.selectedReach);
        }
        else
        {
            ideApp.DisplayAllReaches();
        }
    }

    DisplayReach(reach: Reach)
    {
        this.ClearScene(this.scene);
        this.ClearScene(this.labelScene);
        this.SetLight();
        this.selectedReach = reach.Copy();

        var scaleVector3 = new THREE.Vector3(this.crossScaleX, this.crossScaleY, this.crossScaleZ);
        this.selectedReach.ResetToOrigin();

        if(this.DisplayView.view == 'mesh')
            this.selectedReach.AddToSceneLikeMesh(this.scene, this.labelScene, this.camera, this.cameraHUD, scaleVector3);
        else
            this.selectedReach.AddToSceneLikeLines(this.scene, this.labelScene, this.camera, this.cameraHUD, scaleVector3);
        
        this.selectedReach.CreateLabelAsSprite(this.labelScene,this.camera, scaleVector3, this.ratio);
    
    }

    DisplayAllReaches()
    {
        this.ClearScene(this.scene);
        this.ClearScene(this.labelScene);
        
        this.selectedReach = null;
        var scaleVector3 = new THREE.Vector3(this.crossScaleX, this.crossScaleY, this.crossScaleZ);

        if(this.DisplayView.view == 'mesh')
            this.reachCollection.AddReachesLikeMeshToScene(this.scene, this.labelScene, this.camera,  this.cameraHUD, this.divCanvas, scaleVector3);
        else
            this.reachCollection.AddReachesLikeLinesToScene(this.scene, this.labelScene, this.camera, this.cameraHUD, this.divCanvas, scaleVector3);    
        
        for (var i = 0; i < this.reachCollection.Reaches.length; i++)
        {
            var reach: Reach = this.reachCollection.Reaches[i];
            reach.AddLabelToScene(this.labelScene);
        }
        
        this.SetLight();
    }

    ClearScene(scene: THREE.Scene)
    {
        if(!scene.children)
            return;
        for( var i = scene.children.length - 1; i >= 0; i--)
        { 
            scene.remove(scene.children[i]);
        }
    }

    CreateRenderer(divCanvas)
    {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, clearColor: 0xffffff, antialias: true });
        this.gl = this.renderer.context;
        this.gl.enable(this.gl.DEPTH_TEST);
        this.renderer.autoClear = false;
        this.renderer.state.setStencilTest(true);
        this.renderer.sortObjects = true;
        this.renderer.state.setDepthTest(true);
        this.renderer.setSize(divCanvas.clientWidth, divCanvas.clientHeight);
    }

    CreateTrackBallControls(rotate?: boolean, zoom?: boolean, pan?: boolean, roll?: boolean)
    {
        this.controls = new THREE.OrthographicTrackballControls(this.camera, this.divCanvas);
        this.controls.addEventListener('change', this.Render);
        this.controls.noRotate = (rotate == false || undefined ) ? true : false;
        this.controls.noZoom = (zoom == false || undefined ) ? true : false;
        this.controls.noPan = (pan == false || undefined )? true : false;
        this.controls.noRoll = (roll == false || undefined ) ? true : false;
    }

    CreateControls(rotate?: boolean, zoom?: boolean, pan?: boolean, roll?: boolean, axesHelper?: boolean)
    {
        this.AxesHelperButtonOnClick(this.AxesHelperButton.nativeElement);
        this.CreateTrackBallControls(true, false, true, false);
    }
    
    CreateScenes()
    {
        this.scene = new THREE.Scene();
        this.labelScene = new THREE.Scene();
        this.hudScene = new THREE.Scene();
    }

    CreateCamera()
    {         
        this.camera = new THREE.OrthographicCamera( this.divCanvas.clientWidth / - 2, 
                                                    this.divCanvas.clientWidth / 2, 
                                                    this.divCanvas.clientHeight / 2, 
                                                    this.divCanvas.clientHeight / - 2, 
                                                    -1000000000, 1000000000);
    }

    SetCamera()
    {
        this.ZoomAllButtonOnClick(this.ZoomAllButton.nativeElement);
    }
    
    CreateCameraHUD()
    {
        this.cameraHUD = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    }

    initReachCollection(inputs: Array<String>, callback: Function)
    {
        this.reachCollection.Load(inputs, 1, this.ratio, () => 
        {
            var scaleVector3 = new THREE.Vector3(ideApp.crossScaleX, ideApp.crossScaleY, ideApp.crossScaleZ);
            this.reachCollection.Organize();
            for(var i = 0; i < this.reachCollection.Reaches.length; i++)
            {
                this.reachCollection.Reaches[i].CreateLabelAsSprite(this.labelScene, this.camera, scaleVector3, this.ratio);
            }
            callback();
        });
    }

    CreateLight()
    {
        this.PointLight = new THREE.PointLight( 0xffffff, 1, 0 );
        this.PointLight.position.set(100000000, 1000000000, 1000000000);
        this.AmbientLight = new THREE.AmbientLight(0x000000);
    }

    CreatePlane()
    {
        this.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
    }

    SetLight()
    {
        if(this.AmbientLight)
            this.scene.add(this.AmbientLight);
        if(this.PointLight)
            this.scene.add(this.PointLight);
    }

    Animate()
    {
        var scaleVector3 = new THREE.Vector3(ideApp.crossScaleX, ideApp.crossScaleY, ideApp.crossScaleZ);
        var camOpts = ideApp.camera.toJSON().object;

        if(ideApp.selectedReach)
        {
            ideApp.selectedReach.RefreshLabelPosition(ideApp.camera, ideApp.ratio, scaleVector3); 
        }
        else if(ideApp.prevCtrls == null || 
                camOpts.zoom.toFixed(7) != ideApp.prevCam.toJSON().object.zoom.toFixed(7) || 
                ideApp.prevCtrls.target.x.toFixed(7) != ideApp.controls.target.x.toFixed(7) ||
                ideApp.prevCtrls.target.y.toFixed(7) != ideApp.controls.target.y.toFixed(7) ||
                ideApp.prevCtrls.target.z.toFixed(7) != ideApp.controls.target.z.toFixed(7) ||
                ideApp.prevCam.position.x.toFixed(7) != ideApp.camera.position.x.toFixed(7) ||
                ideApp.prevCam.position.y.toFixed(7) != ideApp.camera.position.y.toFixed(7) ||
                ideApp.prevCam.position.z.toFixed(7) != ideApp.camera.position.z.toFixed(7)
        )
        {
            ideApp.prevCam = _.cloneDeep<THREE.OrthographicCamera>(ideApp.camera);
            ideApp.prevCtrls = _.cloneDeep<THREE.OrthographicTrackballControls>(ideApp.controls);
            for (var i = 0; i < ideApp.reachCollection.Reaches.length; i++)
            {
                var reach = ideApp.reachCollection.Reaches[i];
                reach.RefreshLabelPosition(ideApp.camera, ideApp.ratio, scaleVector3);           
            }
        }
        
        ideApp.controls.update();
        requestAnimationFrame(ideApp.Animate);
        ideApp.Render();
    }

    Render()
    {
        ideApp.AxesHUD.setRotationFromQuaternion(ideApp.camera.quaternion);
        ideApp.renderer.clear();
        ideApp.renderer.render(ideApp.scene, ideApp.camera);
        ideApp.renderer.clearDepth();
        if(ideApp.LabelButton.nativeElement.pressed)
            ideApp.renderer.render(ideApp.labelScene, ideApp.cameraHUD);
        if(ideApp.AxesHelperButton.nativeElement.pressed)
        {
            ideApp.renderer.clearDepth();
            ideApp.renderer.render(ideApp.hudScene, new THREE.Camera());
        }
    }
}

var ideApp: IdeComponent;